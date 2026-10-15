export const UNITS = "pcs|kg|g|lb|l|ml|dozen|pack|carton|meter|yard|sqft|hour|service";
export const FONTS = ["Inter", "Bricolage Grotesque", "DM Serif Display", "Syne", "Manrope"];
export const CURRENCIES = ["PKR", "USD", "AED", "SAR", "GBP", "EUR", "INR", "BDT", "TRY", "EGP", "NGN", "KES", "IDR", "MYR", "CAD", "AUD", "ZAR", "BRL", "MXN"];
// graph source -> default chart type
export const CHARTS = { salesDay: "bar", profitDay: "line", topItems: "pie", payMix: "pie", expenseSplit: "bar", lowStock: "bar", hourly: "area", topCustomers: "bar", siteBudget: "bar", seasonYield: "bar", projectStatus: "pie", repairStatus: "pie", orderStatus: "pie", apptDay: "bar", expiry: "bar" };

// f = form fields: "naam", "naam:number|date|time|tel", "naam:select(a|b)"
// k = kanban board (status field se columns)
export const MODS = {
  sales: {}, purchases: {}, attendance: {}, tables: {},
  appointments: { f: "client,service,staff,date:date,time:time,status:select(booked|done|cancelled)" },
  products: { f: `name,barcode,price:number,cost:number,stock:number,unit:select(${UNITS}),minStock:number,packName,packQty:number,packPrice:number` },
  customers: { f: "name,phone:tel,address,limit:number,balance:number,points:number" },
  suppliers: { f: "name,phone:tel,due:number" },
  expenses: { f: "title,amount:number,type:select(rent|utilities|salary|supplies|transport|marketing|repairs|other),date:date" },
  staff: { f: "name,phone:tel,job,salary:number,joined:date" },
  projects: { k: 1, f: "title,client,budget:number,deadline:date,status:select(todo|doing|review|done)" },
  repairs: { k: 1, f: "device,imei,customer,phone:tel,issue,cost:number,status:select(received|diagnosing|repairing|ready|delivered)" },
  sites: { f: "name,location,budget:number,spent:number,status:select(planned|active|done)" },
  materials: { f: "name,site,qty:number,unit,cost:number,date:date" },
  seasons: { f: "field,crop,area:number,sowDate:date,harvestDate:date,expectedYield:number,actualYield:number,status:select(sown|growing|harvested)" },
  orders: { f: "customer,phone:tel,items,total:number,channel:select(web|whatsapp|instagram|facebook|walk-in),status:select(new|packed|shipped|delivered|returned),tracking" },
  quotes: { f: "customer,items,amount:number,validTill:date,status:select(draft|sent|accepted|rejected)" }
};

export const parse = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
  const m = x.match(/^(\w+)(?::(\w+))?(?:\((.*)\))?$/);
  return m ? { k: m[1], type: m[2] || "text", opts: m[3] ? m[3].split("|") : null } : null;
}).filter(Boolean);

const th = (p, a, bg, ink, font, r) => ({ p, a, bg, ink, font, r });
// L = module label (dictionary key), extra = extra fields, pos = tiles|list, samples = "naam,price,cost,stock;..."
export const CATS = {
  grocery: { name: "Kiryana / General store", icon: "🛒", nav: "side", pos: "list", theme: th("#2F7D32", "#F2A900", "#F1F7EA", "#17301B", "Bricolage Grotesque", "10px"),
    mods: ["sales", "products", "customers", "suppliers", "purchases", "expenses", "staff", "attendance"], L: { customers: "ledger" },
    charts: [["salesDay", "bar"], ["topItems", "pie"], ["lowStock", "bar"], ["profitDay", "line"]], samples: "Rice 1kg,320,280,50;Cooking oil 1L,540,490,30;Sugar 1kg,150,130,40" },
  restaurant: { name: "Restaurant / Cafe", icon: "🍽️", nav: "side", pos: "tiles", theme: th("#D9480F", "#7A1F2B", "#FFF3E8", "#3A1608", "DM Serif Display", "22px"),
    mods: ["tables", "sales", "products", "purchases", "suppliers", "expenses", "staff", "attendance"], L: { products: "menu", sales: "orders_m" }, extra: { products: "section" },
    charts: [["hourly", "area"], ["topItems", "bar"], ["salesDay", "line"], ["expenseSplit", "pie"]], samples: "Biryani,450,250,50;Karahi,1200,800,30;Tea,80,25,100" },
  clothing: { name: "Clothing / Boutique", icon: "👗", nav: "top", pos: "tiles", theme: th("#8E3FB5", "#E85D9C", "#FAF2FA", "#2A1233", "Syne", "4px"),
    mods: ["sales", "products", "customers", "suppliers", "purchases", "expenses", "staff"], L: { products: "articles", customers: "clients" }, extra: { products: "size,color,season" },
    charts: [["salesDay", "line"], ["topItems", "pie"], ["lowStock", "bar"]], samples: "Kurta M,3500,2200,12;Shalwar Kameez L,5200,3300,8;Dupatta,1200,600,25" },
  pharmacy: { name: "Pharmacy", icon: "💊", nav: "side", pos: "list", theme: th("#0E8C99", "#2563EB", "#ECF6F7", "#0B3138", "Manrope", "14px"),
    mods: ["sales", "products", "customers", "suppliers", "purchases", "expenses", "staff", "attendance"], L: { products: "medicines", customers: "patients" }, extra: { products: "batch,expiry:date,rx:select(no|yes)" },
    charts: [["salesDay", "line"], ["expiry", "bar"], ["lowStock", "bar"], ["payMix", "pie"]], samples: "Paracetamol 500mg,60,40,200;Cough syrup,280,200,40;ORS sachet,30,20,150" },
  electronics: { name: "Electronics / Mobile shop", icon: "📱", nav: "side", pos: "list", theme: th("#1E3A8A", "#38BDF8", "#EEF3FC", "#0F1F4D", "Manrope", "8px"),
    mods: ["sales", "products", "repairs", "customers", "suppliers", "purchases", "expenses", "staff"], extra: { products: "imei,warranty:date,brand" },
    charts: [["salesDay", "bar"], ["repairStatus", "pie"], ["topItems", "bar"]], samples: "Phone charger,900,500,40;Earbuds,2500,1500,25;Screen guard,300,100,80" },
  salon: { name: "Salon / Services", icon: "✂️", nav: "top", pos: "tiles", theme: th("#B8476B", "#C9A24B", "#FFF2F5", "#3A1220", "Syne", "28px"),
    mods: ["appointments", "sales", "customers", "products", "staff", "attendance", "expenses"], L: { products: "services", customers: "clients", sales: "billing" },
    charts: [["apptDay", "bar"], ["salesDay", "bar"], ["topItems", "pie"]], samples: "Haircut,800,0,999;Facial,2500,500,999;Beard trim,400,0,999" },
  wholesale: { name: "Wholesale / Distributor", icon: "📦", nav: "side", pos: "list", theme: th("#1F3A5F", "#E0A100", "#EEF1F5", "#111C2D", "Manrope", "6px"),
    mods: ["sales", "orders", "quotes", "customers", "suppliers", "purchases", "products", "expenses", "staff"],
    charts: [["salesDay", "bar"], ["topCustomers", "bar"], ["payMix", "pie"], ["lowStock", "bar"]], samples: "Flour 50kg bag,6500,6000,100;Sugar 50kg bag,7600,7100,80" },
  freelancer: { name: "Freelancer / Agency", icon: "💼", nav: "side", pos: "list", theme: th("#4338CA", "#06B6D4", "#EFEFFC", "#1B1A4A", "Inter", "8px"),
    mods: ["projects", "customers", "sales", "quotes", "expenses"], L: { sales: "invoices", customers: "clients" },
    charts: [["salesDay", "line"], ["projectStatus", "pie"], ["topCustomers", "bar"], ["expenseSplit", "bar"]] },
  construction: { name: "Construction / Contractor", icon: "🏗️", nav: "side", pos: "list", theme: th("#B7791F", "#374151", "#FBF6E9", "#2B2108", "Bricolage Grotesque", "6px"),
    mods: ["sites", "materials", "staff", "attendance", "suppliers", "expenses", "sales"], L: { sales: "invoices", staff: "labor" },
    charts: [["siteBudget", "bar"], ["expenseSplit", "pie"], ["salesDay", "bar"]] },
  agriculture: { name: "Agriculture / Farm", icon: "🌾", nav: "side", pos: "list", theme: th("#6B4F1D", "#65A30D", "#F5F1E6", "#2B2008", "DM Serif Display", "16px"),
    mods: ["seasons", "products", "sales", "customers", "staff", "attendance", "suppliers", "purchases", "expenses"], L: { products: "inputs", sales: "harvest" },
    charts: [["seasonYield", "bar"], ["salesDay", "line"], ["expenseSplit", "pie"]], samples: "Wheat seed 40kg,9000,8500,10;DAP fertilizer 50kg,12000,11000,15" },
  online: { name: "Online store", icon: "🛍️", nav: "top", pos: "tiles", theme: th("#2563EB", "#EC4899", "#EEF3FE", "#10224F", "Syne", "18px"),
    mods: ["orders", "sales", "products", "customers", "suppliers", "purchases", "expenses"],
    charts: [["salesDay", "bar"], ["orderStatus", "pie"], ["topItems", "bar"], ["profitDay", "line"]], samples: "T-shirt,1800,900,40;Cap,900,400,60;Bag,3200,1800,20" }
};

export function getCat(b) {
  if (b.category !== "custom") return CATS[b.category];
  const c = b.custom || {}, col = c.color || "#0E7490";
  return { name: c.name || "Custom", icon: c.icon || "🏪", nav: c.nav || "side", pos: c.pos || "list", custom: 1,
    theme: th(col, "#F2A900", `color-mix(in srgb, ${col} 9%, white)`, "#1D1D1B", c.font || "Inter", c.r || "14px"),
    mods: c.mods || ["sales", "products", "customers", "expenses"], L: c.L || {}, extra: c.extra || {}, charts: c.charts || [["salesDay", "bar"], ["topItems", "pie"]] };
              }
