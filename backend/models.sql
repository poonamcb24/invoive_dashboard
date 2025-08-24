DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  invoice_no VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount_total DECIMAL(12,2) NOT NULL,
  status ENUM('UNPAID','PARTIAL','PAID') DEFAULT 'UNPAID',
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

INSERT INTO customers (name) VALUES
('ABC Ltd'),
('XYZ Inc'),
('Glide Systems'),
('OmniSoft'),
('Nova Retail');

INSERT INTO invoices (customer_id, invoice_no, invoice_date, due_date, amount_total, status) VALUES
(1, 'INV-1001', '2025-05-02', '2025-05-20', 10000.00, 'UNPAID'),
(2, 'INV-1002', '2025-05-10', '2025-05-30', 15000.00, 'PARTIAL'),
(3, 'INV-1003', '2025-06-05', '2025-06-25', 22000.00, 'UNPAID'),
(4, 'INV-1004', '2025-06-15', '2025-07-05', 12000.00, 'PAID'),
(5, 'INV-1005', '2025-07-01', '2025-07-20', 18000.00, 'UNPAID'),
(1, 'INV-1006', '2025-07-10', '2025-07-30', 8000.00, 'UNPAID'),
(2, 'INV-1007', '2025-08-01', '2025-08-20', 26000.00, 'UNPAID'),
(3, 'INV-1008', '2025-08-05', '2025-08-25', 9000.00, 'PARTIAL'),
(4, 'INV-1009', '2025-08-10', '2025-08-30', 14000.00, 'UNPAID');

INSERT INTO payments (invoice_id, amount, payment_date) VALUES
(2, 5000.00, '2025-05-20'),
(4, 12000.00, '2025-06-20'),
(8, 3000.00, '2025-08-15');
