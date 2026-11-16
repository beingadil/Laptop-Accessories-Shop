# PRD.md — Tayyab Enterprises Desktop Management Software

**Product Name:** Tayyab Enterprises Management System  
**Document Type:** Product Requirements Document (PRD)  
**Version:** 1.0  
**Status:** Final  
**Currency:** PKR  
**Language:** English  
**Platform:** Desktop Application  
**Development Stack:** Next.js + React + TypeScript + SQLite + Prisma + Electron  
**Deployment:** Single Computer, Offline-Capable Desktop Software

---

# 1. Project Overview

Tayyab Enterprises Management System is a modern desktop application designed to manage a laptop and computer accessories shop.

The software will provide complete management of:

- Laptop inventory
- Chromebook inventory
- Laptop chargers
- Laptop accessories
- Laptop batteries
- RAM, SSD, HDD and storage products
- Sales and invoices
- Purchases and suppliers
- Customer records
- Supplier payments
- Shop expenses
- Returns and exchanges
- Warranty records
- Stock adjustments
- Profit calculations
- Reports and exports
- Manual backup and restoration

The application must be easy to use, reliable, fast, and suitable for daily shop operations.

## 1.1 Main Objectives

- Replace manual inventory and sales records.
- Maintain accurate stock quantities and individual laptop records.
- Generate professional A4 invoices.
- Track sales, purchases, payments, expenses and profit.
- Maintain customer and supplier histories.
- Track warranties and product returns.
- Provide detailed reports with Excel and PDF export.
- Allow safe editing and deletion of records.
- Maintain complete stock movement and record history.
- Work offline on one computer.
- Provide a modern, professional desktop interface.

---

# 2. Shop Information

The application must use the following shop information.

**Shop Name:** Tayyab Enterprises

**Address:** Muneer Chowk, Shop No. 152

**Contact Numbers:**
- 03126482836
- 03298304862

Shop information must be editable from Settings.

The following information must appear on invoices:

- Shop name
- Shop address
- Shop contact numbers
- Invoice number
- Invoice date
- Customer information
- Product details
- Quantity
- Unit price
- Total amount
- Payment method
- Warranty information
- Invoice footer
- Warranty terms

The shop must be able to upload its own logo.

---

# 3. Technology Stack & Architecture

## 3.1 Development Stack

| Component | Technology |
|---|---|
| Framework | Next.js |
| Frontend | React |
| Programming Language | TypeScript |
| UI Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Database | SQLite |
| ORM | Prisma |
| Desktop Wrapper | Electron |
| Packaging | Electron Builder |
| PDF | PDF generation library |
| Excel | ExcelJS |
| Icons | Lucide React |

## 3.2 Development Strategy

The project must be developed in the following sequence:

1. Build the complete Next.js application.
2. Complete all UI screens and business modules.
3. Implement database operations and business logic.
4. Complete inventory, sales, purchases and reporting.
5. Test the complete application in browser/development environment.
6. Fix errors and verify all business workflows.
7. Wrap the completed Next.js application with Electron.
8. Configure desktop database storage and filesystem access.
9. Configure printing, PDF export and backup functionality.
10. Package the application into a Windows installer.

**Electron must be added at the final stage. The project must not be developed as a separate Electron-first application.**

## 3.3 Desktop Architecture

The final desktop application must use a secure Electron architecture.

- Electron Main Process manages the desktop application.
- Electron Preload provides secure IPC communication.
- Next.js provides the application UI and backend routes/server logic.
- SQLite stores all business data locally.
- Prisma manages database access.
- Electron handles native desktop capabilities.
- The packaged application must launch without requiring the user to install Node.js.

The packaged Electron application must start the local Next.js runtime and load the application through a local interface.

The Next.js backend must remain available locally inside the desktop application.

## 3.4 Security Requirements

- Disable Electron Node integration in the renderer.
- Enable context isolation.
- Use a secure preload script.
- Access desktop functionality through controlled IPC.
- Never expose database credentials or unrestricted filesystem access to the renderer.
- Store application data in an appropriate persistent application-data directory.
- Ensure database files remain available after application updates.

---

# 4. UI/UX Design Requirements

## 4.1 Design Style

The application must have a modern, professional and clean desktop interface.

**Theme:** Light

Design characteristics:

- Clean dashboard
- Modern sidebar navigation
- Professional typography
- Consistent spacing
- Rounded cards
- Clear tables
- Attractive buttons
- Professional forms
- Smooth navigation
- Proper loading states
- Clear success and error messages

The interface must look like modern business management software, not an outdated accounting application.

## 4.2 Main Layout

The application must contain:

### Sidebar Navigation

- Dashboard
- Products
- Inventory
- Sales
- Purchases
- Customers
- Suppliers
- Supplier Payments
- Expenses
- Returns & Exchanges
- Warranty
- Reports
- Settings

### Top Header

- Global search
- Current date
- Quick actions
- Admin profile
- Application branding

## 4.3 Form Requirements

Every module must have proper forms.

- Forms must be displayed on full-window pages.
- Large forms must not be restricted to small modal dialogs.
- Form fields must be properly organized.
- Required fields must be validated.
- Dropdowns must be searchable where appropriate.
- Save and Cancel actions must be clearly visible.
- Forms must support editing existing records.
- Validation errors must be displayed clearly.
- Loading and submission states must be supported.

Small confirmation dialogs may be used for delete confirmation and other minor actions.

## 4.4 Table Requirements

All major listing pages must support:

- Pagination
- Search
- Sorting
- Filters
- Date filtering where applicable
- Page-size selection
- Record details
- Edit action
- Delete action
- Export where applicable

Default page size should be 20 records.

Supported page sizes:

- 10
- 20
- 50
- 100

Pagination must be server-side/database-side, not merely frontend pagination of the entire dataset.

---

# 5. Dashboard

The dashboard must provide a quick overview of shop performance.

## 5.1 Dashboard Cards

- Total Products
- Total Laptop Stock
- Total Chromebook Stock
- Total Accessories Stock
- Today's Sales
- Today's Profit
- Monthly Sales
- Monthly Profit
- Total Expenses
- Low Stock Products
- Out of Stock Products
- Supplier Outstanding Balance

## 5.2 Dashboard Sections

- Recent Sales
- Recent Purchases
- Low Stock Products
- Out of Stock Products
- Recent Expenses
- Monthly Sales Chart
- Monthly Profit Chart

Dashboard values must be calculated from actual database records.

The dashboard must not display hardcoded or fake statistics.

---

# 6. Product Management

## 6.1 Product Categories

The system must include these default categories:

- Laptops
- Laptop Chargers
- Laptop Accessories
- Laptop Batteries
- RAM
- SSD
- HDD
- Chromebooks

The admin must also be able to create custom categories.

Category management must support:

- Add category
- Edit category
- Delete category
- Category search
- Category status

Categories containing products must not be deleted without appropriate handling.

## 6.2 Product Information

Every product must support:

- Product Name
- SKU
- Category
- Brand
- Model
- Description
- Purchase Price
- Selling Price
- Minimum Stock Level
- Current Stock
- Product Type
- Status
- Created Date
- Updated Date

## 6.3 Laptop Specifications

Laptop products must support:

- Brand
- Model
- Processor
- RAM
- SSD
- HDD
- Screen Size (optional)
- Condition
- Serial Number

Laptop condition options:

- New
- Used
- Refurbished

Laptop records must support individual serial-number-based inventory.

## 6.4 Chromebook Specifications

Chromebook records must support:

- Brand
- Model
- Processor
- RAM
- Storage
- Condition
- Serial Number

Chromebooks must also use individual inventory tracking.

## 6.5 Accessories

Accessory products must support quantity-based inventory.

Examples:

- Laptop Chargers
- Type-C Chargers
- Laptop Batteries
- RAM
- SSD
- HDD
- Other Laptop Accessories

Accessories must have:

- Product Name
- Brand
- Model
- SKU
- Purchase Price
- Selling Price
- Available Quantity
- Minimum Stock Level

---

# 7. Inventory Management

Inventory management is a core module.

## 7.1 Inventory Types

The system must support two inventory methods.

### Individual Inventory

Used for:

- Laptops
- Chromebooks

Each individual item must have:

- Serial Number
- Product
- Purchase Price
- Selling Price
- Condition
- Purchase Reference
- Stock Status
- Warranty Information

### Quantity Inventory

Used for:

- Laptop Chargers
- Accessories
- Batteries
- RAM
- SSD
- HDD

Each product must maintain:

- Available Quantity
- Purchase Cost
- Selling Price
- Stock Movement History

## 7.2 Opening Stock

The system must support opening stock entry.

Opening stock must be recorded with:

- Product
- Quantity or serial numbers
- Purchase Cost
- Selling Price
- Opening Stock Date
- Notes

Opening stock must create stock movement records.

## 7.3 Stock Alerts

The system must support:

- Low Stock Alerts
- Out of Stock Alerts

Low stock must be based on each product's minimum stock level.

## 7.4 Stock Adjustments

The system must support:

- Damaged Stock
- Lost Stock
- Quantity Correction
- Stock Increase
- Stock Decrease

Each adjustment must record:

- Product
- Quantity
- Adjustment Type
- Reason
- Date
- Previous Stock
- New Stock
- Admin User

Stock adjustments must maintain a complete history.

## 7.5 Stock Movement History

Every stock movement must be recorded.

Movement types:

- Opening Stock
- Purchase
- Sale
- Sale Return
- Purchase Return (future-ready)
- Exchange
- Stock Adjustment
- Damaged Stock
- Lost Stock

Stock movement records must not be silently modified or deleted.

---

# 8. Sales Management

## 8.1 Sales System

The application must use a simple invoice-based sales system.

It is not a POS application.

## 8.2 Create Sale

The sale form must support:

- Invoice Number
- Sale Date
- Customer Selection
- Product Selection
- Product Search
- Serial Number Selection
- Quantity
- Unit Price
- Discount
- Line Total
- Grand Total
- Payment Method
- Warranty Duration
- Invoice Notes

Payment method:

- Cash only

## 8.3 Sale Rules

- Available stock must be checked before completing a sale.
- Serial-numbered items must be selected individually.
- A serialized item cannot be sold more than once.
- Quantity products must not be sold beyond available stock.
- Sale prices must be editable during the sale.
- Selling prices must default from product records.
- Discounts must be supported.
- Invoice numbers must be unique.
- Stock must be updated automatically after sale confirmation.
- Sales must create stock movement records.
- Sales must update profit calculations.
- Sales must create warranty records where applicable.

## 8.4 Invoice

Invoice format:

- A4

Invoice must include:

- Shop Logo
- Shop Name
- Shop Address
- Contact Numbers
- Invoice Number
- Invoice Date
- Customer Name
- Customer Phone
- Product Details
- Serial Number where applicable
- Quantity
- Unit Price
- Discount
- Total Amount
- Payment Method
- Warranty Information
- Warranty Terms
- Footer

Invoice actions:

- Print Invoice
- Download PDF
- View Invoice
- Reprint Invoice

## 8.5 Sales Management

The sales listing page must support:

- Search
- Date Filters
- Invoice Search
- Customer Filter
- Pagination
- View Details
- Edit Sale
- Delete Sale
- Print Invoice
- Export

## 8.6 Sale Editing and Deletion

Sales must be editable and deletable.

Editing or deleting a sale must:

- Recalculate stock correctly.
- Recalculate profit correctly.
- Maintain stock movement history.
- Preserve an audit record.
- Validate that the stock changes are possible.
- Handle linked returns and exchanges safely.

Deleted financial records must remain auditable.

---

# 9. Purchase Management

## 9.1 Purchase Entry

Purchase forms must support:

- Purchase Number
- Purchase Date
- Supplier
- Product
- Quantity
- Serial Numbers
- Purchase Price
- Total Amount
- Paid Amount
- Outstanding Amount
- Notes

## 9.2 Purchase Rules

- Purchases must increase stock automatically.
- Serialized purchases must create individual inventory records.
- Quantity purchases must increase available stock.
- Purchase costs must be stored.
- Supplier balances must update automatically.
- Purchase entries must create stock movements.
- Purchases must be linked to suppliers.

## 9.3 Purchase Management

The purchase listing page must support:

- Search
- Supplier Filter
- Date Filter
- Pagination
- View Purchase
- Edit Purchase
- Delete Purchase
- Export

## 9.4 Purchase Editing and Deletion

Purchases must be editable and deletable.

Editing or deleting a purchase must:

- Reverse the original stock effect.
- Apply the updated purchase effect.
- Update supplier balances.
- Recalculate stock valuation.
- Maintain stock movement history.
- Preserve audit records.

If purchased stock has already been sold or otherwise consumed, unsafe deletion must be prevented or require an appropriate correction workflow.

---

# 10. Customer Management

The customer module must maintain basic customer information.

## 10.1 Customer Fields

- Customer Name
- Phone Number
- Address (optional)
- Notes (optional)
- Created Date

## 10.2 Customer Features

- Add Customer
- Edit Customer
- Delete Customer
- Search Customer
- View Customer Details
- View Purchase History
- View Invoices
- Export Customers

Customer purchase history must show:

- Invoice Number
- Date
- Products
- Amount
- Warranty Information

Walk-in customers must be supported without requiring a permanent customer record.

---

# 11. Supplier Management

## 11.1 Supplier Fields

- Supplier Name
- Phone Number
- Address
- Notes
- Opening Balance (optional)
- Status

## 11.2 Supplier Features

- Add Supplier
- Edit Supplier
- Delete Supplier
- Search Supplier
- View Supplier Details
- View Purchase History
- View Payment History
- View Outstanding Balance
- Export Suppliers

Supplier records containing transactions must be protected against unsafe deletion.

---

# 12. Supplier Payment Management

Supplier payment tracking must be supported.

## 12.1 Payment Entry

Payment fields:

- Supplier
- Payment Date
- Amount
- Payment Method
- Reference Number (optional)
- Notes

Payment method:

- Cash

## 12.2 Supplier Ledger

Each supplier must have a ledger showing:

- Opening Balance
- Purchases
- Payments
- Adjustments
- Outstanding Balance

## 12.3 Supplier Balance

The supplier outstanding balance must be calculated automatically.

The supplier payment module must support:

- Add Payment
- Edit Payment
- Delete Payment
- View Payment Details
- Search
- Date Filters
- Pagination
- Export

Editing or deleting payments must update supplier balances correctly.

---

# 13. Expense Management

The software must provide a shop expense module.

## 13.1 Expense Categories

Default categories:

- Rent
- Electricity
- Internet
- Salary
- Transport
- Repair
- Miscellaneous

Custom categories must also be supported.

## 13.2 Expense Entry

Fields:

- Expense Title
- Expense Category
- Amount
- Expense Date
- Description
- Notes

## 13.3 Expense Features

- Add Expense
- Edit Expense
- Delete Expense
- Search Expenses
- Filter by Category
- Filter by Date
- Daily Expense Report
- Monthly Expense Report
- Export Expenses

All expenses must be included in net profit calculations.

---

# 14. Profit Management

The application must calculate profit automatically.

## 14.1 Sales Profit

Sales profit must be calculated from:

- Sale Price
- Inventory Cost
- Discount
- Sales Returns
- Exchange Adjustments

## 14.2 Net Profit

Net Profit = Gross Sales Profit − Shop Expenses

The system must provide:

- Daily Profit
- Monthly Profit
- Yearly Profit
- Product-wise Profit
- Category-wise Profit
- Invoice-wise Profit

## 14.3 Inventory Cost Calculation

- Serialized laptops and Chromebooks must use their individual recorded purchase costs.
- Quantity-based products must use a consistent inventory valuation method.
- Average purchase cost is the preferred initial method for quantity-based products.
- Stock valuation must remain consistent when purchases, sales, returns and adjustments are edited.

The application must clearly distinguish:

- Sales Revenue
- Cost of Goods Sold
- Gross Profit
- Expenses
- Net Profit

---

# 15. Returns & Exchanges

The application must support product returns and exchanges.

## 15.1 Returns

Return entry must support:

- Original Invoice
- Customer
- Product
- Quantity or Serial Number
- Return Date
- Return Reason
- Refund Amount
- Stock Restock Status
- Notes

Return reasons:

- Defective Product
- Customer Changed Mind
- Wrong Product
- Other

## 15.2 Return Rules

- Returns must be linked to original sales whenever possible.
- Returned serialized items must be marked appropriately.
- Restockable products must return to inventory.
- Damaged products must not automatically become available stock.
- Return amounts must affect profit calculations.
- Return history must be maintained.

## 15.3 Exchanges

The exchange workflow must support:

1. Select Original Invoice.
2. Select Returned Product.
3. Record Return Condition.
4. Select Replacement Product.
5. Calculate Price Difference.
6. Complete Exchange.
7. Update Stock.
8. Update Profit.
9. Maintain Exchange History.

The exchange process must use transactional database operations.

---

# 16. Warranty Management

The software must support both basic invoice warranty information and detailed warranty tracking.

## 16.1 Warranty Information

- Product
- Serial Number
- Customer
- Invoice Number
- Warranty Start Date
- Warranty Duration
- Warranty End Date
- Warranty Terms
- Warranty Status

## 16.2 Warranty Features

- View Warranty Records
- Search by Serial Number
- Search by Customer
- Search by Invoice
- Filter Active Warranties
- Filter Expired Warranties
- View Warranty History

Warranty information must be printed on invoices where applicable.

Warranty records must remain linked to the original sale.

---

# 17. Reports

The system must provide detailed reports.

## 17.1 Sales Reports

- Daily Sales
- Monthly Sales
- Yearly Sales
- Invoice-wise Sales
- Product-wise Sales
- Category-wise Sales
- Customer-wise Sales

## 17.2 Purchase Reports

- Daily Purchases
- Monthly Purchases
- Supplier-wise Purchases
- Product-wise Purchases
- Purchase History

## 17.3 Inventory Reports

- Current Stock
- Serialized Inventory
- Quantity Inventory
- Low Stock
- Out of Stock
- Stock Valuation
- Stock Movement History
- Damaged Stock
- Lost Stock
- Stock Adjustment History

## 17.4 Financial Reports

- Daily Profit
- Monthly Profit
- Yearly Profit
- Gross Profit
- Net Profit
- Expense Reports
- Supplier Outstanding
- Supplier Payment History

## 17.5 Customer Reports

- Customer List
- Customer Purchase History
- Customer-wise Sales

## 17.6 Export Requirements

Reports must support:

- Excel Export
- PDF Export

Exports must respect current filters and date ranges.

---

# 18. Data Export

The application must support Excel export for:

- Products
- Inventory
- Sales
- Purchases
- Customers
- Suppliers
- Supplier Payments
- Expenses
- Returns
- Warranty Records
- Stock Movements

Export files must contain properly formatted columns and useful headings.

---

# 19. Settings & Configuration

The Settings module must include:

## 19.1 Shop Settings

- Shop Name
- Address
- Contact Numbers
- Logo
- Invoice Footer
- Warranty Terms

## 19.2 Invoice Settings

- Invoice Format
- Invoice Number Prefix
- Invoice Footer
- Warranty Display
- Shop Logo

## 19.3 Inventory Settings

- Default Minimum Stock
- Stock Alert Configuration

## 19.4 Admin Settings

- Admin Username
- Admin Password Change

## 19.5 Backup Settings

- Manual Backup
- Manual Restore
- Backup Location

---

# 20. Authentication

The application must have a single Admin login.

## 20.1 Admin Features

- Login
- Logout
- Change Password

## 20.2 Authentication Rules

- Only one Admin account is required.
- Passwords must be securely hashed.
- Passwords must never be stored in plain text.
- Protected modules must require authentication.
- The application must not expose unrestricted database access.

Employee roles and multi-user permissions are outside the initial scope.

---

# 21. Manual Backup & Restore

The application must support manual backup and restoration.

## 21.1 Backup

The admin must be able to:

- Create Backup
- Select Backup Location
- Save Backup File
- View Backup Confirmation

Backups must include:

- Database
- Business Records
- Inventory
- Sales
- Purchases
- Customers
- Suppliers
- Expenses
- Warranty Records
- Shop Settings

## 21.2 Restore

The application must support:

- Select Backup File
- Confirm Restore
- Restore Database
- Restart or Refresh Application

Restore must validate the backup before replacing existing data.

A warning must be displayed before restoring because existing data may be overwritten.

---

# 22. Record Editing & Deletion

Every major module must support proper editing and deletion.

Modules:

- Products
- Categories
- Customers
- Suppliers
- Sales
- Purchases
- Supplier Payments
- Expenses
- Returns
- Stock Adjustments
- Warranty Records

## 22.1 Editing Requirements

- Existing record data must load into the form.
- Changes must be validated.
- Related stock and financial calculations must update.
- Changes must be saved transactionally.
- Record history must be maintained.

## 22.2 Deletion Requirements

- Delete confirmation must be required.
- Related records must be checked.
- Stock and financial effects must be reversed safely.
- Deleted records must remain auditable.
- Unsafe deletion must be prevented.

Financial and stock transactions should use soft deletion or audited reversal entries where appropriate.

The UI must provide clear delete actions, while the backend preserves data integrity.

---

# 23. Database Design

The application must use SQLite with Prisma ORM.

## 23.1 Main Database Entities

The database should include the following entities:

### ProductCategory

- id
- name
- description
- status
- createdAt
- updatedAt

### Product

- id
- name
- SKU
- categoryId
- brand
- model
- processor
- RAM
- SSD
- HDD
- condition
- description
- purchasePrice
- sellingPrice
- minimumStock
- inventoryType
- status
- createdAt
- updatedAt

### SerializedInventoryItem

- id
- productId
- serialNumber
- purchasePrice
- sellingPrice
- condition
- purchaseId
- stockStatus
- createdAt
- updatedAt

### StockMovement

- id
- productId
- serializedItemId
- movementType
- quantity
- referenceType
- referenceId
- previousStock
- newStock
- reason
- createdAt

### Customer

- id
- name
- phone
- address
- notes
- createdAt
- updatedAt

### Supplier

- id
- name
- phone
- address
- notes
- createdAt
- updatedAt

### Purchase

- id
- purchaseNumber
- supplierId
- purchaseDate
- totalAmount
- paidAmount
- outstandingAmount
- notes
- status
- createdAt
- updatedAt

### PurchaseItem

- id
- purchaseId
- productId
- quantity
- unitCost
- totalCost

### SupplierPayment

- id
- supplierId
- paymentDate
- amount
- paymentMethod
- referenceNumber
- notes
- createdAt

### Sale

- id
- invoiceNumber
- customerId
- saleDate
- subtotal
- discount
- totalAmount
- paymentMethod
- status
- notes
- createdAt
- updatedAt

### SaleItem

- id
- saleId
- productId
- serializedItemId
- quantity
- unitPrice
- unitCost
- discount
- totalAmount

### ExpenseCategory

- id
- name
- status

### Expense

- id
- title
- categoryId
- amount
- expenseDate
- description
- notes
- createdAt
- updatedAt

### Return

- id
- originalSaleId
- customerId
- returnDate
- reason
- refundAmount
- notes
- createdAt

### ReturnItem

- id
- returnId
- saleItemId
- productId
- serializedItemId
- quantity
- restockStatus
- condition

### Warranty

- id
- saleId
- saleItemId
- customerId
- productId
- serializedItemId
- warrantyStart
- warrantyEnd
- warrantyTerms
- status

### AuditLog

- id
- entityType
- entityId
- action
- previousData
- updatedData
- adminUserId
- createdAt

### AdminUser

- id
- username
- passwordHash
- createdAt
- updatedAt

The schema may be refined during implementation while preserving all required business functionality.

---

# 24. Business Rules & Data Integrity

The following rules are mandatory.

## 24.1 Stock Rules

- Stock must never become negative.
- Serialized items cannot be sold twice.
- Serial numbers must be unique.
- Purchases must increase stock.
- Sales must decrease stock.
- Returns must update stock correctly.
- Exchanges must update both returned and replacement stock.
- Adjustments must create stock movement records.

## 24.2 Transaction Rules

Purchase, sale, return and exchange operations must use database transactions.

If any operation fails, all related changes must be rolled back.

For example, completing a sale must atomically:

1. Validate available stock.
2. Save the sale.
3. Save sale items.
4. Update inventory.
5. Create stock movements.
6. Create warranty records.
7. Update financial calculations.

## 24.3 Editing Rules

Editing financial transactions must safely reverse the previous effects and apply the updated effects.

If a transaction cannot be safely edited because its stock has already been consumed or related returns exist, the application must prevent the operation or require a corrective workflow.

## 24.4 Invoice Rules

- Invoice numbers must be unique.
- Invoice numbering must not produce duplicates.
- Each completed sale must have a permanent invoice reference.
- Deleted invoices must remain auditable.
- Invoice history must be preserved.

---

# 25. Performance & Database Requirements

Performance is a major requirement.

## 25.1 Pagination

Every large listing must use database-level pagination.

Pagination must support:

- Page Number
- Page Size
- Total Records
- Total Pages
- Next Page
- Previous Page

## 25.2 N+1 Query Prevention

**N+1 queries must be prevented in every module.**

Requirements:

- Use Prisma `select` and `include` appropriately.
- Use joins or batched queries when needed.
- Avoid querying related records individually inside loops.
- Fetch related information efficiently.
- Avoid unnecessary database requests.
- Use proper indexes for searchable fields.
- Use server-side pagination.
- Optimize dashboard aggregation queries.

This requirement applies to:

- Products
- Inventory
- Sales
- Purchases
- Customers
- Suppliers
- Supplier Payments
- Expenses
- Returns
- Warranty
- Reports

## 25.3 Database Indexes

Indexes should be created for frequently searched fields, including:

- SKU
- Product Name
- Serial Number
- Invoice Number
- Purchase Number
- Customer Phone
- Supplier Name
- Sale Date
- Purchase Date
- Expense Date
- Warranty End Date

## 25.4 Performance Expectations

The application should remain responsive during normal shop operations.

- Pagination should not load the entire dataset.
- Search should return results efficiently.
- Dashboard calculations should use optimized database queries.
- Reports should use optimized aggregations.
- Large exports should not freeze the UI unnecessarily.

---

# 26. Error Handling

The application must provide clear error handling.

Requirements:

- Form validation
- Database error handling
- Duplicate serial number prevention
- Duplicate invoice prevention
- Stock availability validation
- Transaction rollback
- Backup validation
- Restore validation
- User-friendly error messages
- Error logging for debugging

Technical errors must not expose sensitive database details to the user.

---

# 27. Non-Functional Requirements

## 27.1 Reliability

The application must maintain accurate stock and financial records.

## 27.2 Usability

The software must be easy to use for daily shop operations.

## 27.3 Security

- Secure Admin login
- Password hashing
- Secure Electron configuration
- Controlled IPC
- Protected database access

## 27.4 Maintainability

- TypeScript
- Reusable components
- Modular architecture
- Clear business logic
- Consistent naming
- Database migrations
- Proper validation

## 27.5 Offline Support

The application must work without an internet connection.

No cloud database or internet connection should be required for normal operations.

---

# 28. Electron Desktop Requirements

Electron wrapping must be completed after the Next.js application is fully developed and tested.

## 28.1 Desktop Features

- Windows desktop application
- Application icon
- Window controls
- Persistent local database
- Native print support
- PDF saving
- Backup file selection
- Restore file selection
- Desktop installer
- Application startup
- Application shutdown

## 28.2 Packaging

The application must be packaged using Electron Builder.

Deliverables:

- Windows installer
- Installed desktop application
- Persistent application data directory
- Desktop shortcut
- Application icon

## 28.3 Database Persistence

Database must not be stored in a temporary application directory.

The database must remain available after:

- Application restart
- Computer restart
- Application update
- Application reinstall where data preservation is intended

Database migrations must be handled safely.

---

# 29. Testing Requirements

The application must be tested before release.

## 29.1 Functional Testing

Test all major workflows:

- Admin login
- Product creation
- Product editing
- Product deletion
- Opening stock
- Stock adjustment
- Purchase entry
- Purchase editing
- Purchase deletion
- Supplier payments
- Sale creation
- Sale editing
- Sale deletion
- Invoice printing
- Returns
- Exchanges
- Warranty creation
- Expenses
- Profit calculations
- Reports
- Excel export
- PDF export
- Backup
- Restore

## 29.2 Inventory Testing

Verify:

- Serialized stock
- Quantity stock
- Duplicate serial prevention
- Stock availability
- Low stock alerts
- Out of stock alerts
- Stock movement history
- Correct stock after editing sales
- Correct stock after editing purchases
- Correct stock after returns and exchanges

## 29.3 Performance Testing

Verify:

- Pagination
- Search
- N+1 prevention
- Database indexes
- Dashboard performance
- Report performance

## 29.4 Electron Testing

Verify:

- Desktop startup
- Database persistence
- Printing
- Backup
- Restore
- Installer
- Application updates
- Application restart

---

# 30. Development Phases

The development process must follow this order.

## Phase 1 — Project Setup

- Next.js setup
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma
- SQLite
- Project structure
- Layout
- Sidebar
- Header
- Theme

## Phase 2 — Core Modules

- Dashboard
- Categories
- Products
- Inventory
- Opening Stock
- Stock Adjustments

## Phase 3 — Business Modules

- Customers
- Suppliers
- Purchases
- Supplier Payments
- Sales
- A4 Invoices

## Phase 4 — Financial Modules

- Expenses
- Profit Calculation
- Returns
- Exchanges
- Warranty

## Phase 5 — Reports & Settings

- Reports
- Excel Export
- PDF Export
- Shop Settings
- Invoice Settings
- Admin Authentication
- Backup
- Restore

## Phase 6 — Data Integrity & Optimization

- Editing and deletion workflows
- Audit history
- Stock consistency
- Financial consistency
- Pagination
- N+1 query prevention
- Database indexes
- Performance optimization
- Testing

## Phase 7 — Electron Integration

Only after the complete Next.js application is ready:

- Configure Electron
- Configure secure preload
- Configure IPC
- Start local Next.js runtime
- Connect persistent database
- Configure printing
- Configure backup and restore
- Configure application icon
- Configure Electron Builder

## Phase 8 — Final Release

- Production build
- Windows installer
- Installation testing
- Database persistence testing
- Complete workflow testing
- Final bug fixing

---

# 31. MVP Scope

The initial release must include:

- Dashboard
- Products
- Categories
- Serialized Inventory
- Quantity Inventory
- Opening Stock
- Stock Adjustments
- Sales
- A4 Invoices
- Purchases
- Customers
- Suppliers
- Supplier Payments
- Expenses
- Profit Calculation
- Returns
- Exchanges
- Warranty
- Reports
- Excel Export
- PDF Export
- Admin Login
- Manual Backup
- Manual Restore
- Editing and Deletion
- Pagination
- N+1 Query Prevention
- Electron Desktop Packaging

---

# 32. Out of Scope

The following features are not required in the initial release:

- Multi-computer synchronization
- Cloud database
- Online synchronization
- Barcode scanning
- Barcode printing
- POS system
- Multiple payment methods
- Credit sales
- Customer installments
- Employee accounts
- Employee permissions
- Automatic cloud backup
- Multi-currency
- Mobile application
- Urdu interface
- Thermal receipt printing

These features may be considered in future versions.

---

# 33. Acceptance Criteria

The application will be considered complete when:

1. It runs as a Windows desktop application.
2. The complete Next.js application is developed before Electron wrapping.
3. Products and categories can be managed.
4. Laptops and Chromebooks support individual serial tracking.
5. Accessories support quantity-based stock.
6. Opening stock can be entered.
7. Purchases automatically update inventory.
8. Sales automatically update inventory.
9. Stock cannot become negative.
10. Sales generate A4 invoices.
11. Invoices contain Tayyab Enterprises branding.
12. Sales can be edited and deleted safely.
13. Purchases can be edited and deleted safely.
14. Supplier payments update outstanding balances.
15. Expenses are recorded and reported.
16. Daily and monthly profit calculations work correctly.
17. Returns and exchanges update stock and profit.
18. Warranty records are maintained.
19. Reports support filtering and pagination.
20. Excel and PDF exports work.
21. Manual backup and restoration work.
22. Data persists after application restart.
23. N+1 queries are prevented across all modules.
24. All major modules contain proper full-page forms.
25. Tables support pagination and search.
26. Database transactions protect financial and inventory operations.
27. Record history is maintained.
28. The Windows installer works correctly.
29. The software works offline.
30. The interface is modern, professional and easy to use.

---

# 34. Final Product Definition

Tayyab Enterprises Management System is a complete offline desktop management application for a laptop and computer accessories shop.

The software must provide accurate inventory, professional invoices, supplier management, customer records, purchase management, sales management, expense tracking, profit calculation, warranty records, stock adjustments, returns, exchanges and reporting.

The application must first be developed as a complete Next.js application using TypeScript, React, SQLite and Prisma.

After the application is completed, tested and optimized, Electron must be added to package it as a Windows desktop application.

The final product must be secure, reliable, modern, easy to use and suitable for daily business operations.

**End of PRD.**