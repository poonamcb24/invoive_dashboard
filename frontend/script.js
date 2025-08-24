const API_BASE = "http://127.0.0.1:9090";

document.addEventListener("DOMContentLoaded", () => {
    loadKPIs();
    loadInvoices();
    loadChart();

    document.getElementById("filterBtn").addEventListener("click", applyFilters);
});

async function loadKPIs() {
    const res = await fetch(`${API_BASE}/kpi`);
    const data = await res.json();

    document.getElementById("totalInvoiced").innerText = data.total_invoiced;
    document.getElementById("totalReceived").innerText = data.total_received;
    document.getElementById("totalOutstanding").innerText = data.total_outstanding;
    document.getElementById("percentOverdue").innerText = data.percent_overdue + "%";
}

async function loadInvoices(filters = {}) {
    let url = `${API_BASE}/invoices`;
    if (filters.customer || filters.startDate || filters.endDate) {
        url += "?" + new URLSearchParams(filters).toString();
    }

    const res = await fetch(url);
    const invoices = await res.json();

    const tableBody = document.getElementById("invoiceTableBody");
    tableBody.innerHTML = "";

    invoices.forEach(inv => {
        const row = document.createElement("tr");
        if (inv.status === "Overdue") row.classList.add("overdue");

        row.innerHTML = `
            <td>${inv.id}</td>
            <td>${inv.customer}</td>
            <td>${inv.date}</td>
            <td>${inv.amount}</td>
            <td>${inv.received}</td>
            <td>${inv.status}</td>
            <td>
                <button onclick="openPaymentForm(${inv.id})">Record Payment</button>
            </td>
        `;

        tableBody.appendChild(row);
    });
}


function applyFilters() {
    const customer = document.getElementById("customerFilter").value;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;

    loadInvoices({ customer, startDate, endDate });
}


function openPaymentForm(invoiceId) {
    const form = document.getElementById("paymentForm");
    form.style.display = "block";
    form.dataset.invoiceId = invoiceId;
}


async function submitPayment() {
    const invoiceId = document.getElementById("paymentForm").dataset.invoiceId;
    const amount = document.getElementById("paymentAmount").value;
    const date = document.getElementById("paymentDate").value;

    const res = await fetch(`${API_BASE}/record_payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId, amount, date })
    });

    if (res.ok) {
        alert("Payment recorded successfully!");
        document.getElementById("paymentForm").style.display = "none";
        loadKPIs();
        loadInvoices();
        loadChart();
    } else {
        alert("Error recording payment.");
    }
}

async function loadChart() {
    const res = await fetch(`${API_BASE}/chart`);
    const data = await res.json();

    const ctx = document.getElementById("invoiceChart").getContext("2d");

    new Chart(ctx, {
        type: "bar", 
        data: {
            labels: data.labels,
            datasets: [{
                label: "Outstanding Amount",
                data: data.values,
                backgroundColor: "rgba(75, 192, 192, 0.6)"
            }]
        },
        options: { responsive: true }
    });
}
