from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import date, datetime
from dotenv import load_dotenv
import os
from db import query

load_dotenv()

app = Flask(__name__)
CORS(app)

def parse_date(s):
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None

@app.get("/api/customers")
def get_customers():
    rows = query("SELECT id, name FROM customers ORDER BY name")
    return jsonify(rows)

@app.get("/api/invoices")
def get_invoices():
    customer_id = request.args.get("customer_id")
    q = request.args.get("q", "").strip()
    dfrom = parse_date(request.args.get("from"))
    dto = parse_date(request.args.get("to"))
    sort = request.args.get("sort", "invoice_date")
    order = request.args.get("order", "desc")
    if sort not in {"invoice_no","customer_name","invoice_date","due_date","amount_total","status","outstanding"}:
        sort = "invoice_date"
    order = "desc" if order.lower() == "desc" else "asc"

    filters = []
    params = {}

    if customer_id:
        filters.append("i.customer_id = %(customer_id)s")
        params["customer_id"] = customer_id
    if dfrom:
        filters.append("i.invoice_date >= %(dfrom)s")
        params["dfrom"] = dfrom
    if dto:
        filters.append("i.invoice_date <= %(dto)s")
        params["dto"] = dto
    if q:
        filters.append("(i.invoice_no LIKE %(q)s OR c.name LIKE %(q)s)")
        params["q"] = f"%{q}%"

    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    sql = f"""
        SELECT
          i.id,
          i.invoice_no,
          c.name AS customer_name,
          i.invoice_date,
          i.due_date,
          i.amount_total,
          i.status,
          COALESCE(i.amount_total - p.paid, i.amount_total) AS outstanding
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        LEFT JOIN (
          SELECT invoice_id, SUM(amount) AS paid
          FROM payments
          GROUP BY invoice_id
        ) p ON p.invoice_id = i.id
        {where}
        ORDER BY {sort} {order}
    """
    rows = query(sql, params)
    
    today = date.today()
    for r in rows:
        due = r["due_date"]
        r["overdue"] = (r["outstanding"] and r["outstanding"] > 0 and due and due < today)
    return jsonify(rows)

@app.post("/api/payments")
def record_payment():
    data = request.get_json(force=True)
    invoice_id = data.get("invoice_id")
    amount = data.get("amount")
    payment_date = data.get("payment_date")
    if not all([invoice_id, amount, payment_date]):
        return jsonify({"error": "invoice_id, amount, payment_date required"}), 400
    try:
        dt = datetime.strptime(payment_date, "%Y-%m-%d").date()
    except Exception:
        return jsonify({"error":"payment_date must be YYYY-MM-DD"}), 400

    res = query(
        "INSERT INTO payments (invoice_id, amount, payment_date) VALUES (%(i)s,%(a)s,%(d)s)",
        {"i": invoice_id, "a": amount, "d": dt}
    )
    return jsonify({"ok": True, "payment_id": res.get("lastrowid")})

@app.get("/api/kpis")
def kpis():
    customer_id = request.args.get("customer_id")
    dfrom = parse_date(request.args.get("from"))
    dto = parse_date(request.args.get("to"))

    filters = []
    params = {}

    if customer_id:
        filters.append("i.customer_id = %(customer_id)s")
        params["customer_id"] = customer_id
    if dfrom:
        filters.append("i.invoice_date >= %(dfrom)s")
        params["dfrom"] = dfrom
    if dto:
        filters.append("i.invoice_date <= %(dto)s")
        params["dto"] = dto

    where = ("WHERE " + " AND ".join(filters)) if filters else ""

    totals = query(f"""
        SELECT
          COALESCE(SUM(i.amount_total),0) AS total_invoiced,
          COALESCE(SUM(paid),0) AS total_received,
          COALESCE(SUM(i.amount_total - COALESCE(paid,0)),0) AS total_outstanding
        FROM (
            SELECT i.*, x.paid
            FROM invoices i
            LEFT JOIN (
                SELECT invoice_id, SUM(amount) AS paid
                FROM payments
                GROUP BY invoice_id
            ) x ON x.invoice_id = i.id
        ) i
        {where}
    """, params)[0]


    rows = query(f"""
        SELECT
          COUNT(*) AS total_invoices,
          SUM(CASE WHEN (i.due_date < CURDATE()) AND (i.amount_total - COALESCE(x.paid,0) > 0) THEN 1 ELSE 0 END) AS overdue_invoices
        FROM invoices i
        LEFT JOIN (
            SELECT invoice_id, SUM(amount) AS paid
            FROM payments
            GROUP BY invoice_id
        ) x ON x.invoice_id = i.id
        {where}
    """, params)[0]

    pct_overdue = 0.0
    if rows["total_invoices"]:
        pct_overdue = round((rows["overdue_invoices"] or 0) * 100.0 / rows["total_invoices"], 2)

    return jsonify({
        "totalInvoiced": float(totals["total_invoiced"] or 0),
        "totalReceived": float(totals["total_received"] or 0),
        "totalOutstanding": float(totals["total_outstanding"] or 0),
        "percentOverdue": pct_overdue
    })

@app.get("/api/top-customers")
def top_customers():
    limit = int(request.args.get("limit", "5"))
    dfrom = request.args.get("from")
    dto = request.args.get("to")
    filters = []
    params = {}
    if dfrom:
        filters.append("i.invoice_date >= %(dfrom)s")
        params["dfrom"] = dfrom
    if dto:
        filters.append("i.invoice_date <= %(dto)s")
        params["dto"] = dto
    where = ("WHERE " + " AND ".join(filters)) if filters else ""

    sql = f"""
        SELECT c.id, c.name,
               SUM(i.amount_total - COALESCE(p.paid,0)) AS outstanding
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        LEFT JOIN (
          SELECT invoice_id, SUM(amount) AS paid
          FROM payments
          GROUP BY invoice_id
        ) p ON p.invoice_id = i.id
        {where}
        GROUP BY c.id, c.name
        HAVING outstanding > 0
        ORDER BY outstanding DESC
        LIMIT %(limit)s
    """
    params["limit"] = limit
    rows = query(sql, params)
    return jsonify(rows)

@app.get("/api/monthly")
def monthly():
    dfrom = request.args.get("from")
    dto = request.args.get("to")
    filters = []
    params = {}

    if dfrom:
        filters.append("i.invoice_date >= %(dfrom)s")
        params["dfrom"] = dfrom
    if dto:
        filters.append("i.invoice_date <= %(dto)s")
        params["dto"] = dto
    where = ("WHERE " + " AND ".join(filters)) if filters else ""

    sql = f"""
        SELECT
          DATE_FORMAT(i.invoice_date, '%%Y-%%m-01') AS month,
          SUM(i.amount_total) AS invoiced,
          COALESCE(SUM(p.amount), 0) AS received
        FROM invoices i
        LEFT JOIN payments p ON p.invoice_id = i.id
        {where}
        GROUP BY month
        ORDER BY month
    """
    rows = query(sql, params)
    return jsonify(rows)



if __name__ == "__main__":
    app.run(debug=True, port=9090)

