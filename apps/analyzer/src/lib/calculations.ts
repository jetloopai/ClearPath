export interface AnalysisInputs {
  address: string;
  purchasePrice: number;
  condition: "cosmetic" | "light" | "medium" | "heavy" | "gut";
}

export interface AnalysisResults {
  arv: number;
  rehabLow: number;
  rehabHigh: number;
  rehabEstimate: number;
  rentEstimate: number;
  rentPerUnit: number;
  units: number;
  monthlyCashFlow: number;
  cashOnCash: number;
  flipProfit: number;
  flipROI: number;
  mao: number;
  signal: "green" | "yellow" | "red";
  rentalSignal: "green" | "yellow" | "red";
  flipSignal: "green" | "yellow" | "red";
  isCookCounty: boolean;
}

export function performFastAnalysis(inputs: AnalysisInputs): AnalysisResults {
  const baseValue = inputs.purchasePrice;
  
  const arvMultipliers: Record<string, number> = {
    cosmetic: 1.2,
    light: 1.3,
    medium: 1.45,
    heavy: 1.6,
    gut: 1.8
  };
  
  const rehabPerSqftRanges: Record<string, [number, number]> = {
    cosmetic: [10, 20],
    light: [20, 35],
    medium: [35, 55],
    heavy: [55, 85],
    gut: [85, 150],
  };
  
  const arv = Math.round(baseValue * arvMultipliers[inputs.condition]);
  
  const sqft = 1400; // placeholder
  const [lowRate, highRate] = rehabPerSqftRanges[inputs.condition];
  const rehabLow = Math.round(sqft * lowRate);
  const rehabHigh = Math.round(sqft * highRate);
  const rehabEstimate = Math.round((rehabLow + rehabHigh) / 2);
  
  // Rent: ~0.8% of ARV
  const rentEstimate = Math.round(arv * 0.008);
  
  // Mortgage (80% LTV, ~7.5%, 30yr)
  const loanAmount = baseValue * 0.8;
  const monthlyRate = 0.075 / 12;
  const numPayments = 360;
  const mortgage = Math.round(loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1));
  
  // Expenses (vacancy 8%, mgmt 10%, maintenance 6%, capex 5%, insurance $100, taxes ~1.5% ARV / 12)
  const vacancy = rentEstimate * 0.08;
  const mgmt = rentEstimate * 0.10;
  const maintenance = rentEstimate * 0.06;
  const capex = rentEstimate * 0.05;
  const insurance = 100;
  const taxes = (arv * 0.015) / 12;
  const totalExpenses = vacancy + mgmt + maintenance + capex + insurance + taxes;
  
  const monthlyCashFlow = Math.round(rentEstimate - mortgage - totalExpenses);
  
  // Cash-on-cash
  const downPayment = baseValue * 0.25;
  const closingCosts = baseValue * 0.02;
  const totalCashIn = downPayment + closingCosts + rehabEstimate;
  const annualCashFlow = monthlyCashFlow * 12;
  const cashOnCash = Math.round((annualCashFlow / totalCashIn) * 1000) / 10;
  
  // Flip profit
  const sellingCosts = arv * 0.08;
  const holdingCosts = (baseValue * 0.01) * 6;
  const flipProfit = Math.round(arv - baseValue - rehabEstimate - sellingCosts - holdingCosts);
  const flipROI = Math.round((flipProfit / (baseValue + rehabEstimate)) * 1000) / 10;
  
  // MAO (70% rule)
  const mao = Math.round(arv * 0.7 - rehabEstimate);
  
  // Signals
  let rentalSignal: "green" | "yellow" | "red" = "yellow";
  if (monthlyCashFlow >= 300) rentalSignal = "green";
  else if (monthlyCashFlow < 0) rentalSignal = "red";
  
  let flipSignal: "green" | "yellow" | "red" = "yellow";
  if (flipProfit >= 30000) flipSignal = "green";
  else if (flipProfit < 10000) flipSignal = "red";
  
  const signal = rentalSignal === "green" && flipSignal === "green" ? "green" 
    : rentalSignal === "red" || flipSignal === "red" ? "red" 
    : "yellow";

  const addr = inputs.address.toLowerCase();
  const isCookCounty = addr.includes("chicago") || addr.includes("cook") || 
    addr.includes("tinley") || addr.includes("oak forest") || addr.includes("bolingbrook") ||
    addr.includes("joliet") || addr.includes("calumet") || addr.includes("harvey") ||
    addr.includes("cicero") || addr.includes("berwyn") || addr.includes("evanston");

  return {
    arv, rehabLow, rehabHigh, rehabEstimate, rentEstimate,
    rentPerUnit: rentEstimate, units: 1,
    monthlyCashFlow, cashOnCash, flipProfit, flipROI, mao,
    signal, rentalSignal, flipSignal, isCookCounty
  };
}
