/* Smart EMI & Loan Repayment Planner
   All the calculations for the website are in this one file:
     1. Helpers
     2. EMI formula
     3. Repayment plan (month by month)
     4. Calculate button: EMI, affordability, extra payments and the yearly table
*/

/* ---------- 1. Helpers ---------- */

function el(id) {
  return document.getElementById(id);
}

// 5000000 -> "₹50,00,000" (Indian style)
function rupees(x) {
  return '₹' + Math.round(x).toLocaleString('en-IN');
}

// 5000000 -> "₹50 lakh"
function inWords(x) {
  if (x >= 10000000) return '₹' + +(x / 10000000).toFixed(2) + ' crore';
  if (x >= 100000) return '₹' + +(x / 100000).toFixed(2) + ' lakh';
  return rupees(x);
}

// 201 months -> "16 years 9 months"
function timeText(months) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  let text = '';
  if (y > 0) text += y + (y === 1 ? ' year' : ' years');
  if (m > 0) text += (text ? ' ' : '') + m + (m === 1 ? ' month' : ' months');
  return text || '0 months';
}

/* ---------- 2. EMI formula ----------
   EMI = P × r × (1 + r)^n ÷ [(1 + r)^n − 1]
   P = loan amount, r = monthly rate (yearly rate ÷ 12 ÷ 100), n = number of months */

function calcEmi(P, ratePerYear, months) {
  const r = ratePerYear / 12 / 100;
  if (r === 0) return P / months;
  const f = Math.pow(1 + r, months);
  return (P * r * f) / (f - 1);
}

// Largest loan whose EMI fits into a given monthly amount (the formula turned around)
function maxLoanFor(emi, ratePerYear, months) {
  const r = ratePerYear / 12 / 100;
  if (emi <= 0) return 0;
  if (r === 0) return emi * months;
  const f = Math.pow(1 + r, months);
  return (emi * (f - 1)) / (r * f);
}

/* ---------- 3. Repayment plan ----------
   Each month: interest = loan left × r, and the rest of the EMI reduces the loan.
   The extra yearly payment is paid after every 12th EMI, and the EMI stays the same,
   so the loan simply finishes earlier. */

function repaymentPlan(P, ratePerYear, months, extraPerYear) {
  const r = ratePerYear / 12 / 100;
  const emi = calcEmi(P, ratePerYear, months);
  let loanLeft = P;
  let month = 0;
  let totalInterest = 0;
  const years = [];

  while (loanLeft > 0.005 && month < months) {
    month++;
    const interest = loanLeft * r;
    const payment = Math.min(emi, loanLeft + interest); // the last EMI can be smaller
    loanLeft -= payment - interest;
    totalInterest += interest;

    let extra = 0;
    if (month % 12 === 0 && extraPerYear > 0) {
      extra = Math.min(extraPerYear, loanLeft);
      loanLeft -= extra;
    }
    if (loanLeft < 0.005) loanLeft = 0;

    // add this month to its year
    const y = Math.ceil(month / 12);
    if (!years[y - 1]) years[y - 1] = { year: y, interest: 0, repaid: 0, left: 0 };
    const row = years[y - 1];
    row.interest += interest;
    row.repaid += payment - interest + extra; // loan repaid this year, including any extra payment
    row.left = loanLeft;
  }

  return { emi, months: month, totalInterest, years };
}

/* ---------- 4. Calculate button ---------- */

let loan = null;          // the latest results
let showAllYears = false; // the yearly table starts short

function calculate() {
  const P = Math.max(1000, Number(el('amount').value) || 0);
  const rate = Math.max(0, Number(el('rate').value) || 0);
  const years = Math.min(40, Math.max(1, Math.round(Number(el('years').value) || 1)));
  const salary = Math.max(0, Number(el('salary').value) || 0);
  const extra = Math.max(0, Number(el('extra').value) || 0);
  const months = years * 12;

  const normal = repaymentPlan(P, rate, months, 0);
  const withExtra = repaymentPlan(P, rate, months, extra);

  loan = { P, rate, years, months, salary, extra, normal, withExtra };
  showAllYears = false;

  showEmi();
  showAffordability();
  showExtraPayments();
  showTable();
}

// Your EMI
function showEmi() {
  const { P, years, normal } = loan;
  const total = P + normal.totalInterest;
  const loanPart = (P / total) * 100;

  el('amountWords').textContent = inWords(P);
  el('emi').textContent = rupees(normal.emi);
  el('emiFor').textContent = 'every month for ' + years + (years === 1 ? ' year' : ' years');
  el('interest').textContent = rupees(normal.totalInterest);
  el('total').textContent = rupees(total);
  el('barLoan').style.width = loanPart + '%';
  el('barInt').style.width = (100 - loanPart) + '%';
  el('loanShare').textContent = Math.round(loanPart) + '%';
  el('intShare').textContent = Math.round(100 - loanPart) + '%';
}

// Can you afford it?  Up to 40% of salary = Safe, 40-50% = Careful, above 50% = Risky
function showAffordability() {
  const { salary, rate, months, normal } = loan;
  if (salary <= 0) {
    el('affordResult').innerHTML = '<p class="small">Enter your monthly salary to check this.</p>';
    return;
  }
  const share = (normal.emi / salary) * 100;
  const s = share <= 40 ? { word: 'Safe', css: 'safe' } : share <= 50 ? { word: 'Careful', css: 'careful' } : { word: 'Risky', css: 'risky' };

  // Both numbers below are worked out again for every loan:
  const left = salary - normal.emi;                          // salary minus this EMI
  const safeLoan = maxLoanFor(salary * 0.4, rate, months);   // loan whose EMI = 40% of salary, same rate and tenure

  el('affordResult').innerHTML =
    '<p class="result-line"><b>' + Math.round(share) + '%</b> of your salary goes to this EMI <span class="status ' + s.css + '">' + s.word + '</span></p>' +
    '<div class="meter"><div class="meter-fill" style="width:' + Math.min(share, 100) + '%"></div>' +
    '<div class="meter-mark" style="left:40%"><span>40%</span></div><div class="meter-mark" style="left:50%"><span>50%</span></div></div>' +
    '<div class="facts">' +
      '<div class="fact"><span>Money left each month after the EMI</span><b>' + (left >= 0 ? rupees(left) : '−' + rupees(-left)) + '</b></div>' +
      '<div class="fact"><span>Safe loan limit for your salary (EMI up to 40%)</span><b>' + rupees(safeLoan) + '</b></div>' +
    '</div>';
}

// Save with extra payments
function showExtraPayments() {
  const { extra, normal, withExtra } = loan;
  if (extra <= 0) {
    el('extraResult').innerHTML = '<p class="small">Enter an extra yearly payment to see how much you save.</p>';
    return;
  }
  const saved = Math.round(normal.totalInterest) - Math.round(withExtra.totalInterest);
  const early = normal.months - withExtra.months;
  el('extraResult').innerHTML =
    '<p class="saving">Paying ' + rupees(extra) + ' extra every year saves you ' + rupees(saved) + ' in interest' +
    (early > 0 ? ' and you finish ' + timeText(early) + ' early' : '') + '.</p>' +
    '<table class="compare"><tr><th></th><th>Without extra</th><th>With extra</th></tr>' +
    '<tr><td>Monthly EMI</td><td>' + rupees(normal.emi) + '</td><td>' + rupees(withExtra.emi) + '</td></tr>' +
    '<tr><td>Total interest</td><td>' + rupees(normal.totalInterest) + '</td><td>' + rupees(withExtra.totalInterest) + '</td></tr>' +
    '<tr><td>Loan finishes in</td><td>' + timeText(normal.months) + '</td><td>' + timeText(withExtra.months) + '</td></tr></table>';
}

// Year-by-year repayment: shows 5 years first, with a button for the rest
function showTable() {
  const plan = loan.extra > 0 ? loan.withExtra : loan.normal;
  const rows = showAllYears ? plan.years : plan.years.slice(0, 5);

  el('tableNote').textContent = loan.extra > 0
    ? 'Loan repaid includes your extra payment of ' + rupees(loan.extra) + ' every year.'
    : 'How much interest you pay, how much of the loan you repay, and what is left after each year.';

  let html = '<thead><tr><th>Year</th><th>Interest paid</th><th>Loan repaid</th><th>Loan left</th></tr></thead><tbody>';
  rows.forEach((y) => {
    html += '<tr><td>Year ' + y.year + '</td><td class="int">' + rupees(y.interest) + '</td><td class="paid">' +
      rupees(y.repaid) + '</td><td><b>' + rupees(y.left) + '</b></td></tr>';
  });
  el('yearTable').innerHTML = html + '</tbody>';

  const more = el('moreBtn');
  more.hidden = plan.years.length <= 5;
  more.textContent = showAllYears ? 'Show fewer years' : 'Show all ' + plan.years.length + ' years';
}

/* ---------- Start ---------- */

el('loanForm').addEventListener('submit', (e) => {
  e.preventDefault(); // stay on the page
  calculate();
});

el('moreBtn').addEventListener('click', () => {
  showAllYears = !showAllYears;
  showTable();
});

calculate(); // show results for the sample values straight away
