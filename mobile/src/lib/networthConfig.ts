export type FieldType = "text" | "number" | "date" | "select" | "boolean";

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  options?: { label: string; value: string }[];
  required?: boolean;
}

export interface NetWorthConstructConfig {
  type: string;
  label: string;
  category: "asset" | "liability";
  fields: FieldConfig[];
}

export const NETWORTH_CONFIG: Record<string, NetWorthConstructConfig> = {
  pPFAccount: {
    type: "pPFAccount",
    label: "PPF Account",
    category: "asset",
    fields: [
      { name: "currentBalance", label: "Current Balance", type: "number", required: true },
      { name: "setupDate", label: "Setup Date", type: "date", required: true },
      { name: "monthlyMinimumBalance", label: "Monthly Minimum Balance", type: "number", required: true },
      { name: "currentInterestRate", label: "Interest Rate (%)", type: "number" },
    ],
  },
  ePFAccount: {
    type: "ePFAccount",
    label: "EPF Account",
    category: "asset",
    fields: [
      { name: "currentBalance", label: "Current Balance", type: "number", required: true },
      { name: "monthlyEmployeeContribution", label: "Monthly Employee Contribution", type: "number", required: true },
      { name: "monthlyEmployerContribution", label: "Monthly Employer Contribution", type: "number", required: true },
      { name: "setupDate", label: "Setup Date", type: "date", required: true },
      { name: "epfCreditDay", label: "EPF Credit Day (1-31)", type: "number", required: true },
      { name: "annualInterestCreditDate", label: "Annual Interest Credit Date (MM-DD)", type: "text", required: true },
    ],
  },
  fDAccount: {
    type: "fDAccount",
    label: "Fixed Deposit",
    category: "asset",
    fields: [
      { name: "bankName", label: "Bank Name", type: "text", required: true },
      { name: "principalAmount", label: "Principal Amount", type: "number", required: true },
      { name: "startDate", label: "Start Date", type: "date", required: true },
      { name: "maturityDate", label: "Maturity Date", type: "date", required: true },
      { name: "annualInterestRate", label: "Annual Interest Rate (%)", type: "number", required: true },
      { name: "payoutType", label: "Payout Type", type: "select", options: [{ label: "Cumulative", value: "CUMULATIVE" }, { label: "Non-Cumulative", value: "NON_CUMULATIVE" }], required: true },
      { name: "compoundingFrequency", label: "Compounding Frequency", type: "select", options: [{ label: "Quarterly", value: "QUARTERLY" }, { label: "Monthly", value: "MONTHLY" }, { label: "Yearly", value: "YEARLY" }, { label: "Half Yearly", value: "HALF_YEARLY" }], required: true },
      { name: "autoRenewal", label: "Auto Renewal", type: "boolean" },
    ],
  },
  rDAccount: {
    type: "rDAccount",
    label: "Recurring Deposit",
    category: "asset",
    fields: [
      { name: "bankName", label: "Bank Name", type: "text", required: true },
      { name: "monthlyDepositAmount", label: "Monthly Deposit Amount", type: "number", required: true },
      { name: "startDate", label: "Start Date", type: "date", required: true },
      { name: "maturityDate", label: "Maturity Date", type: "date", required: true },
      { name: "annualInterestRate", label: "Annual Interest Rate (%)", type: "number", required: true },
      { name: "compoundingFrequency", label: "Compounding Frequency", type: "select", options: [{ label: "Quarterly", value: "QUARTERLY" }, { label: "Monthly", value: "MONTHLY" }, { label: "Yearly", value: "YEARLY" }, { label: "Half Yearly", value: "HALF_YEARLY" }], required: true },
      { name: "rdDepositDay", label: "Deposit Day (1-31)", type: "number", required: true },
      { name: "autoRenewal", label: "Auto Renewal", type: "boolean" },
    ],
  },
  vehicleAsset: {
    type: "vehicleAsset",
    label: "Vehicle",
    category: "asset",
    fields: [
      { name: "type", label: "Vehicle Type", type: "select", options: [{ label: "Car", value: "CAR" }, { label: "Bike", value: "BIKE" }], required: true },
      { name: "brand", label: "Brand", type: "text", required: true },
      { name: "modelName", label: "Model", type: "text", required: true },
      { name: "variant", label: "Variant", type: "text", required: true },
      { name: "manufacturingYear", label: "Manufacturing Year", type: "number", required: true },
      { name: "purchaseDate", label: "Purchase Date", type: "date", required: true },
      { name: "purchasePrice", label: "Purchase Price", type: "number", required: true },
      { name: "fuelType", label: "Fuel Type", type: "text" },
      { name: "odometerAtSetup", label: "Odometer Reading", type: "number" },
      { name: "currentWorth", label: "Current Worth", type: "number", required: true },
    ],
  },
  plotAsset: {
    type: "plotAsset",
    label: "Plot / Land",
    category: "asset",
    fields: [
      { name: "purchasePrice", label: "Purchase Price", type: "number", required: true },
      { name: "purchaseDate", label: "Purchase Date", type: "date", required: true },
      { name: "country", label: "Country", type: "text", required: true },
      { name: "state", label: "State", type: "text", required: true },
      { name: "city", label: "City", type: "text", required: true },
      { name: "locality", label: "Locality", type: "text", required: true },
      { name: "area", label: "Area", type: "number", required: true },
      { name: "areaUnit", label: "Area Unit (sqft, sqm)", type: "text", required: true },
      { name: "currentWorth", label: "Current Worth", type: "number", required: true },
    ],
  },
  independentPropertyAsset: {
    type: "independentPropertyAsset",
    label: "Independent Property",
    category: "asset",
    fields: [
      { name: "purchasePrice", label: "Purchase Price", type: "number", required: true },
      { name: "purchaseDate", label: "Purchase Date", type: "date", required: true },
      { name: "country", label: "Country", type: "text", required: true },
      { name: "state", label: "State", type: "text", required: true },
      { name: "city", label: "City", type: "text", required: true },
      { name: "locality", label: "Locality", type: "text", required: true },
      { name: "landArea", label: "Land Area", type: "number", required: true },
      { name: "landAreaUnit", label: "Land Area Unit", type: "text", required: true },
      { name: "builtUpArea", label: "Built-up Area (sqft)", type: "number", required: true },
      { name: "constructionYear", label: "Construction Year", type: "number", required: true },
      { name: "lastRenovationYear", label: "Last Renovation Year", type: "number" },
      { name: "currentWorth", label: "Current Worth", type: "number", required: true },
    ],
  },
  apartmentAsset: {
    type: "apartmentAsset",
    label: "Apartment",
    category: "asset",
    fields: [
      { name: "purchasePrice", label: "Purchase Price", type: "number", required: true },
      { name: "purchaseDate", label: "Purchase Date", type: "date", required: true },
      { name: "country", label: "Country", type: "text", required: true },
      { name: "state", label: "State", type: "text", required: true },
      { name: "city", label: "City", type: "text", required: true },
      { name: "locality", label: "Locality", type: "text", required: true },
      { name: "builtUpArea", label: "Built-up Area (sqft)", type: "number", required: true },
      { name: "constructionYear", label: "Construction Year", type: "number", required: true },
      { name: "bhk", label: "BHK (e.g. 2BHK)", type: "text" },
      { name: "floorNumber", label: "Floor Number", type: "text" },
      { name: "builder", label: "Builder Name", type: "text" },
      { name: "projectName", label: "Project Name", type: "text" },
      { name: "lastRenovationYear", label: "Last Renovation Year", type: "number" },
      { name: "currentWorth", label: "Current Worth", type: "number", required: true },
    ],
  },
  jewelleryAsset: {
    type: "jewelleryAsset",
    label: "Jewellery",
    category: "asset",
    fields: [
      { name: "metalType", label: "Metal Type", type: "select", options: [{ label: "Gold", value: "GOLD" }, { label: "Silver", value: "SILVER" }, { label: "Platinum", value: "PLATINUM" }], required: true },
      { name: "purity", label: "Purity (e.g. 22 or 24)", type: "number", required: true },
      { name: "netWeight", label: "Net Weight", type: "number", required: true },
      { name: "weightUnit", label: "Weight Unit (g or kg)", type: "select", options: [{ label: "Grams (g)", value: "g" }, { label: "Kilograms (kg)", value: "kg" }], required: true },
      { name: "purchaseDate", label: "Purchase Date", type: "date" },
      { name: "purchasePrice", label: "Purchase Price", type: "number" },
      { name: "currentWorth", label: "Current Worth", type: "number", required: true },
    ],
  },
  receivableAsset: {
    type: "receivableAsset",
    label: "Receivable (Money Owed to You)",
    category: "asset",
    fields: [
      { name: "name", label: "Debtor Name", type: "text", required: true },
      { name: "principalAmount", label: "Principal Amount", type: "number", required: true },
      { name: "setupDate", label: "Date Given", type: "date", required: true },
      { name: "category", label: "Category", type: "select", options: [{ label: "Security Deposit", value: "SECURITY_DEPOSIT" }, { label: "Personal Loan", value: "PERSONAL_LOAN" }, { label: "Refundable Deposit", value: "REFUNDABLE_DEPOSIT" }, { label: "Other", value: "OTHER" }], required: true },
      { name: "expectedReturnDate", label: "Expected Return Date", type: "date" },
      { name: "interestRate", label: "Interest Rate (%)", type: "number" },
      { name: "interestType", label: "Interest Type", type: "select", options: [{ label: "None", value: "NONE" }, { label: "Simple", value: "SIMPLE" }, { label: "Compound", value: "COMPOUND" }] },
      { name: "currentWorth", label: "Current Worth", type: "number", required: true },
    ],
  },
  loanLiability: {
    type: "loanLiability",
    label: "Loan",
    category: "liability",
    fields: [
      { name: "loanType", label: "Loan Type", type: "select", options: [{ label: "Home", value: "HOME" }, { label: "Car", value: "CAR" }, { label: "Personal", value: "PERSONAL" }, { label: "Education", value: "EDUCATION" }], required: true },
      { name: "outstandingBalance", label: "Outstanding Balance", type: "number", required: true },
      { name: "interestRate", label: "Interest Rate (%)", type: "number", required: true },
      { name: "emiAmount", label: "EMI Amount", type: "number", required: true },
      { name: "emiDebitDate", label: "EMI Debit Day (1-31)", type: "number", required: true },
      { name: "interestType", label: "Interest Type", type: "select", options: [{ label: "Fixed", value: "FIXED" }, { label: "Floating", value: "FLOATING" }], required: true },
      { name: "remainingEmiCount", label: "Remaining EMI Count", type: "number" },
    ],
  },
  creditCardLiability: {
    type: "creditCardLiability",
    label: "Credit Card",
    category: "liability",
    fields: [
      { name: "currentOutstanding", label: "Current Outstanding", type: "number", required: true },
      { name: "statementGenerationDay", label: "Statement Day (1-31)", type: "number", required: true },
      { name: "paymentDueDay", label: "Payment Due Day (1-31)", type: "number", required: true },
      { name: "annualInterestRate", label: "Annual Interest Rate (%)", type: "number", required: true },
      { name: "latePaymentFee", label: "Late Payment Fee", type: "number" },
      { name: "annualFee", label: "Annual Fee", type: "number" },
      { name: "annualFeeMonth", label: "Annual Fee Month (1-12)", type: "number" },
      { name: "minimumPaymentPercentage", label: "Minimum Payment (%)", type: "number" },
    ],
  },
  bnplLiability: {
    type: "bnplLiability",
    label: "Buy Now Pay Later (BNPL)",
    category: "liability",
    fields: [
      { name: "provider", label: "Provider (e.g. Amazon Pay Later)", type: "text", required: true },
      { name: "currentOutstanding", label: "Current Outstanding", type: "number", required: true },
      { name: "monthlyInstallment", label: "Monthly Installment", type: "number", required: true },
      { name: "paymentDueDay", label: "Payment Due Day (1-31)", type: "number", required: true },
      { name: "remainingInstallments", label: "Remaining Installments", type: "number" },
      { name: "interestRate", label: "Interest Rate (%)", type: "number" },
      { name: "lateFee", label: "Late Fee", type: "number" },
    ],
  },
  borrowedLiability: {
    type: "borrowedLiability",
    label: "Borrowed Money",
    category: "liability",
    fields: [
      { name: "lenderName", label: "Lender Name", type: "text", required: true },
      { name: "outstandingAmount", label: "Outstanding Amount", type: "number", required: true },
      { name: "borrowDate", label: "Borrow Date", type: "date", required: true },
      { name: "interestRate", label: "Interest Rate (%)", type: "number" },
      { name: "repaymentFrequency", label: "Repayment Frequency", type: "select", options: [{ label: "Monthly", value: "MONTHLY" }, { label: "Quarterly", value: "QUARTERLY" }, { label: "One-Time", value: "ONE_TIME" }] },
      { name: "installmentAmount", label: "Installment Amount", type: "number" },
      { name: "nextRepaymentDate", label: "Next Repayment Date", type: "date" },
      { name: "latePenalty", label: "Late Penalty", type: "number" },
    ],
  },
};
