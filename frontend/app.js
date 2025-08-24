const qs = (params) => Object.entries(params)
  .filter(([,v]) => v !== undefined && v !== null && v !== '')
  .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  .join("&");

const els = {
  customer: document.getElementById("customerFilter"),
  from: document.getElementById("fromDate"),
  to: document.getElementById("toDate"),
  apply: document.getElementById("applyFilters"),
  search: document.getElementById("searchBox"),
  sortBy: document.getElementById("sortBy"),
  sortOrder: document.getElementById("sortOrder"),
  tableBody: document.querySelector("#invoiceTable tbody"),
  kpiInvoiced: document.getElementById("kpiInvoiced"),
  kpiReceived: document.getElementById("kpiReceived"),
  kpiOutstanding: document.getElementById("kpiOutstanding"),
  kpiOverdue: document.getElementById("kpiOverdue"),
  chartMode: document.getElementById("chartMode"),
};

let chartRef = null;

async function fetchJSON(path, opts={}) {
  const res = await fetch(path, { headers: { "Content-Type":"application/json" }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function loadCustomers() {
  const data = await fetchJSON(`${API_BASE}/api/customers`);
  els.customer.innerHTML = `<option value="">All</option>` + data.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

function currency(n) {
  return (n ?? 0).toLocaleString(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
}

async function loadKPIs() {
  const query = qs({ customer_id: els.customer.value, from: els.from.value, to: els.to.value });
  const data = await fetchJSON(`${API_BASE}/api/kpis?${query}`);
  els.kpiInvoiced.textContent = currency(data.totalInvoiced);
  els.kpiReceived.textContent = currency(data.totalReceived);
  els.kpiOutstanding.textContent = currency(data.totalOutstanding);
  els.kpiOverdue.textContent = `${data.percentOverdue}%`;
}

async function loadInvoices() {
  const query = qs({
    customer_id: els.customer.value,
    from: els.from.value,
    to: els.to.value,
    q: els.search.value,
    sort: els.sortBy.value,
    order: els.sortOrder.value,
  });
  const data = await fetchJSON(`${API_BASE}/api/invoices?${query}`);
  els.tableBody.innerHTML = data.map(row => `
    <tr class="${row.overdue ? 'overdue' : ''}">
      <td>${row.invoice_no}</td>
      <td>${row.customer_name}</td>
      <td>${row.invoice_date}</td>
      <td>${row.due_date}</td>
      <td>${currency(row.amount_total)}</td>
      <td>${row.status}</td>
      <td>${currency(row.outstanding)}</td>
      <td><button class="action-btn" data-id="${row.id}" data-inv="${row.invoice_no}">Record Payment</button></td>
    </tr>
  `).join("");

  
  document.querySelectorAll(".action-btn").forEach(btn => {
    btn.addEventListener("click", () => openModal(btn.dataset.id, btn.dataset.inv));
  });
}

function openModal(invoiceId, invoiceNo) {
  document.getElementById("modal").classList.remove("hidden");
  document.getElementById("payInvoiceId").value = invoiceId;
  document.getElementById("payAmount").value = "";
  document.getElementById("payDate").value = new Date().toISOString().slice(0,10);
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

async function savePayment() {
  const invoice_id = document.getElementById("payInvoiceId").value;
  const amount = parseFloat(document.getElementById("payAmount").value || "0");
  const payment_date = document.getElementById("payDate").value;
  if (!invoice_id || !amount || !payment_date) {
    alert("Please fill amount and date.");
    return;
  }
  try {
    await fetchJSON(`${API_BASE}/api/payments`, {
      method: "POST",
      body: JSON.stringify({ invoice_id, amount, payment_date })
    });
    closeModal();
    
    await Promise.all([loadKPIs(), loadInvoices(), drawChart()]);
  } catch (e) {
    alert("Failed to save payment: " + e.message);
  }
}

async function drawChart() {
  const ctx = document.getElementById("chartCanvas").getContext("2d");
  if (chartRef) { chartRef.destroy(); chartRef = null; }

  if (els.chartMode.value === "top") {
    const query = qs({ from: els.from.value, to: els.to.value, limit: 5 });
    const data = await fetchJSON(`${API_BASE}/api/top-customers?${query}`);
    chartRef = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map(x => x.name),
        datasets: [{
          label: "Outstanding",
          data: data.map(x => x.outstanding),
        }]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  } else {
    const query = qs({ from: els.from.value, to: els.to.value });
    const data = await fetchJSON(`${API_BASE}/api/monthly?${query}`);
    chartRef = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map(x => x.month.slice(0,7)),
        datasets: [
          { label: "Invoiced", data: data.map(x => x.invoiced) },
          { label: "Received", data: data.map(x => x.received) }
        ]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  }
}

async function applyAll() {
  await Promise.all([loadKPIs(), loadInvoices(), drawChart()]);
}

document.getElementById("applyFilters").addEventListener("click", applyAll);
document.getElementById("searchBox").addEventListener("input", () => loadInvoices());
document.getElementById("sortBy").addEventListener("change", () => loadInvoices());
document.getElementById("sortOrder").addEventListener("change", () => loadInvoices());
document.getElementById("chartMode").addEventListener("change", drawChart);

document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("savePayment").addEventListener("click", savePayment);

(async () => {
  await loadCustomers();
  await applyAll();
})();
