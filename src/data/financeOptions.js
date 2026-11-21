export const incomeCategories = ['Government Grant', 'Water Charges', 'Maintenance Collection', 'Other Income'];
export const expenseCategories = ['Electricity', 'Staff Salaries', 'Equipment Repair', 'Spare Parts', 'Chemicals', 'Transportation', 'Operational Expenses', 'Other Expenses'];
export const paymentMethods = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'];
export const monthOptions = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date(2020, index, 1)) }));
