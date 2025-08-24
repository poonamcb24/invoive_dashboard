import os
import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "invoicedb"),
    "port": int(os.getenv("DB_PORT", "3306")),
}


cnxpool = pooling.MySQLConnectionPool(pool_name="dash_pool", pool_size=5, **DB_CONFIG)

def query(sql, params=None, many=False):
    conn = cnxpool.get_connection()
    try:
        cur = conn.cursor(dictionary=True)
        if many and isinstance(params, list):
            cur.executemany(sql, params)
        else:
            cur.execute(sql, params or ())
        if cur.with_rows:
            rows = cur.fetchall()
            return rows
        else:
            conn.commit()
            return {"affected": cur.rowcount, "lastrowid": cur.lastrowid}
    finally:
        cur.close()
        conn.close()
