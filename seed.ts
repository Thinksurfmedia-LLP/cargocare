import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create roles
  const roles = [
    {
      name: "ADMIN" as const,
      description: "Administrator with full system access",
    },
    {
      name: "MD" as const,
      description: "Approves shipment plans and bookings",
    },
    {
      name: "LINER_BOOKING_TEAM" as const,
      description: "Team responsible for liner bookings and schedules",
    },
    {
      name: "SHIPMENT_PLAN_TEAM" as const,
      description: "Team handling shipment planning and logistics",
    },
    {
      name: "INACTIVE" as const,
      description: "Newly registered users pending activation",
    },
  ];

  for (const roleData of roles) {
    await prisma.role.upsert({
      where: { name: roleData.name },
      update: {},
      create: roleData,
    });
    console.log(`✅ Created/updated role: ${roleData.name}`);
  }

  // Create admin user
  const adminRole = await prisma.role.findUnique({
    where: { name: "ADMIN" },
  });

  if (adminRole) {
    const adminEmail = "admin@cargocare.com";
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash("admin123", 12);
      
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          name: "System Administrator",
          firstName: "Admin",
          lastName: "User",
          isActive: true,
          emailVerified: true,
          roleId: adminRole.id,
        },
      });
      
      console.log(`✅ Created admin user: ${adminEmail} (password: admin123)`);
    } else {
      console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
    }
  }

  // Create a shipment plan team user for testing
  const shipmentPlanRole = await prisma.role.findUnique({
    where: { name: "SHIPMENT_PLAN_TEAM" },
  });

  // Create a liner booking team user for testing
  const linerBookingRole = await prisma.role.findUnique({
    where: { name: "LINER_BOOKING_TEAM" },
  });

  let plannerUser: any = null;
  let bookingUser: any = null;

  if (shipmentPlanRole) {
    const shipmentUserEmail = "planner@cargocare.com";
    const existingPlannerUser = await prisma.user.findUnique({
      where: { email: shipmentUserEmail },
    });

    if (!existingPlannerUser) {
      const passwordHash = await bcrypt.hash("planner123", 12);
      
      plannerUser = await prisma.user.create({
        data: {
          email: shipmentUserEmail,
          passwordHash,
          name: "John Planner",
          firstName: "John",
          lastName: "Planner",
          isActive: true,
          emailVerified: true,
          roleId: shipmentPlanRole.id,
        },
      });
      
      console.log(`✅ Created shipment planner user: ${shipmentUserEmail} (password: planner123)`);
    } else {
      plannerUser = existingPlannerUser;
      console.log(`ℹ️  Shipment planner user already exists: ${shipmentUserEmail}`);
    }
  }

  if (linerBookingRole) {
    const bookingUserEmail = "booking@cargocare.com";
    const existingBookingUser = await prisma.user.findUnique({
      where: { email: bookingUserEmail },
    });

    if (!existingBookingUser) {
      const passwordHash = await bcrypt.hash("booking123", 12);
      
      bookingUser = await prisma.user.create({
        data: {
          email: bookingUserEmail,
          passwordHash,
          name: "Sarah Booking",
          firstName: "Sarah",
          lastName: "Booking",
          isActive: true,
          emailVerified: true,
          roleId: linerBookingRole.id,
        },
      });
      
      console.log(`✅ Created liner booking user: ${bookingUserEmail} (password: booking123)`);
    } else {
      bookingUser = existingBookingUser;
      console.log(`ℹ️  Liner booking user already exists: ${bookingUserEmail}`);
    }
  }

  // Seed data points first
  await seedDataPoints();

  // Create sample shipment plans and liner bookings if users exist
  if (plannerUser) {
    await createSampleShipmentPlans(plannerUser.id);
  }

  if (bookingUser) {
    await createSampleLinerBookings(bookingUser.id);
  }

  console.log("🎉 Database seeded successfully!");
}

async function seedDataPoints() {
  console.log("🌱 Seeding data points...");

  // Business Branches
  const businessBranches = [
    { name: "Head Office", code: "HO" },
    { name: "Karachi Branch", code: "KHI" },
    { name: "Lahore Branch", code: "LHE" },
    { name: "Islamabad Branch", code: "ISB" },
    { name: "Faisalabad Branch", code: "FSD" },
    { name: "Multan Branch", code: "MLT" },
    { name: "Peshawar Branch", code: "PSH" },
    { name: "Quetta Branch", code: "QTA" },
    { name: "Sialkot Branch", code: "SKT" },
    { name: "Gujranwala Branch", code: "GJR" },
  ];

  for (const branch of businessBranches) {
    await prisma.businessBranch.upsert({
      where: { code: branch.code },
      update: {},
      create: branch,
    });
  }
  console.log(`✅ Created ${businessBranches.length} business branches`);

  // Carriers
  const carriers = [
    "Maersk Line",
    "MSC Mediterranean Shipping Company",
    "CMA CGM",
    "COSCO Shipping Lines",
    "Hapag-Lloyd",
    "Evergreen Marine",
    "ONE (Ocean Network Express)",
    "Yang Ming Marine Transport",
    "PIL Pacific International Lines",
    "Zim Integrated Shipping",
    "Hyundai Merchant Marine",
    "OOCL Orient Overseas Container Line",
    "APL American President Lines",
    "K Line Kawasaki Kisen Kaisha",
    "NYK Nippon Yusen Kabushiki Kaisha",
    "Wan Hai Lines",
    "IRISL Islamic Republic of Iran Shipping Lines",
    "Arkas Line",
    "X-Press Feeders",
    "Unifeeder",
    "COSCO Shipping Lines",
    "China Shipping Container Lines",
    "Emirates Shipping Line",
    "Hamburg Sud",
    "Matson Navigation",
    "Seaboard Marine",
    "Crowley Maritime",
    "King Ocean Services",
    "Zhonggu Logistics",
    "SITC Container Lines",
    "Regional Container Lines",
    "Goldstar Line",
    "Pacific International Lines",
    "Tianjin Shipping Co Ltd",
    "Sinotrans Container Lines",
    "FESCO Transportation Group",
    "Dong Young Shipping",
    "Heung-A Shipping",
    "SM Line Corporation",
    "TS Lines",
    "Interasia Lines",
    "RCL (Regional Container Lines)",
    "KMTC (Korea Marine Transport Co)",
    "Samudera Shipping Line",
    "ANL Container Line",
    "UASC (United Arab Shipping Company)",
    "Grimaldi Lines",
    "Atlantic Container Line",
    "Cargo D",
    "Hapag-Lloyd Express",
  ];

  for (const carrierName of carriers) {
    await prisma.carrier.upsert({
      where: { name: carrierName },
      update: {},
      create: { name: carrierName },
    });
  }
  console.log(`✅ Created ${carriers.length} carriers`);

  // Commodities
  const commodities = [
    "Rice",
    "Cotton",
    "Wheat",
    "Sugar",
    "Textiles",
    "Electronics",
    "Machinery",
    "Pharmaceuticals",
    "Chemicals",
    "Automotive Parts",
    "Furniture",
    "Leather Goods",
    "Sports Equipment",
    "Surgical Instruments",
    "Cement",
    "Steel Products",
    "Plastic Goods",
    "Paper Products",
    "Rubber Products",
    "Food Products",
    "Beverages",
    "Tobacco",
    "Garments",
    "Footwear",
    "Jewelry",
    "Carpets and Rugs",
    "Marble and Stone",
    "Fruits and Vegetables",
    "Seafood",
    "Spices",
  ];

  for (const commodityName of commodities) {
    await prisma.commodity.upsert({
      where: { name: commodityName },
      update: {},
      create: { name: commodityName },
    });
  }
  console.log(`✅ Created ${commodities.length} commodities`);

  // Equipment
  const equipment = [
    "20ft Standard Container",
    "40ft Standard Container",
    "40ft High Cube Container",
    "45ft High Cube Container",
    "20ft Refrigerated Container",
    "40ft Refrigerated Container",
    "20ft Open Top Container",
    "40ft Open Top Container",
    "20ft Flat Rack Container",
    "40ft Flat Rack Container",
    "20ft Tank Container",
    "40ft Tank Container",
    "Platform Container",
    "Bulk Container",
    "Ventilated Container",
    "Insulated Container",
    "Hard Top Container",
    "Side Door Container",
    "Double Door Container",
    "Thermal Container",
  ];

  for (const equipmentName of equipment) {
    await prisma.equipment.upsert({
      where: { name: equipmentName },
      update: {},
      create: { name: equipmentName },
    });
  }
  console.log(`✅ Created ${equipment.length} equipment types`);

  // Loading Ports
  const loadingPorts = [
    { name: "Port of Karachi", country: "Pakistan" },
    { name: "Port Qasim", country: "Pakistan" },
    { name: "Gwadar Port", country: "Pakistan" },
    { name: "Shanghai Port", country: "China" },
    { name: "Shenzhen Port", country: "China" },
    { name: "Ningbo-Zhoushan Port", country: "China" },
    { name: "Guangzhou Port", country: "China" },
    { name: "Qingdao Port", country: "China" },
    { name: "Tianjin Port", country: "China" },
    { name: "Xiamen Port", country: "China" },
    { name: "Singapore Port", country: "Singapore" },
    { name: "Port Klang", country: "Malaysia" },
    { name: "Tanjung Pelepas", country: "Malaysia" },
    { name: "Laem Chabang", country: "Thailand" },
    { name: "Ho Chi Minh Port", country: "Vietnam" },
    { name: "Hai Phong Port", country: "Vietnam" },
    { name: "Colombo Port", country: "Sri Lanka" },
    { name: "Nhava Sheva (JNPT)", country: "India" },
    { name: "Chennai Port", country: "India" },
    { name: "Kolkata Port", country: "India" },
    { name: "Mumbai Port", country: "India" },
    { name: "Cochin Port", country: "India" },
    { name: "Dubai Port", country: "UAE" },
    { name: "Abu Dhabi Port", country: "UAE" },
    { name: "Sharjah Port", country: "UAE" },
  ];

  for (const port of loadingPorts) {
    await prisma.loadingPort.upsert({
      where: { name_country: { name: port.name, country: port.country } },
      update: {},
      create: port,
    });
  }
  console.log(`✅ Created ${loadingPorts.length} loading ports`);

  // Ports of Discharge
  const portsOfDischarge = [
    // { name: "Port of Hamburg", country: "Germany" },
    { name: "Puerto Quetzal", country:  "Guatemala" },
{ name:   "Felixstowe (GBFXT)",  country:  "United Kingdom"  },
{ name:   "Port Klang (MYPKG)",  country:  "Malaysia"  },
{ name:   "Colombo (LKCMB)",  country:  "Sri Lanka"  },
{ name:   "Chittagong (BDCGP)",  country:  "Bangladesh"  },
{ name:   "Izmir (TRIZM)",  country:  "Turkey"  },
{ name:   "Jebel Ali (AEJEA)",  country:  "United Arab Emirates"  },
{ name:   "Toronto (CATOR)",  country:  "Canada"  },
{ name:   "Busan (KRPUS)",  country:  "Korea, Republic of"  },
{ name:   "New York (USNYC)",  country:  "United States"  },
{ name:   "Rotterdam (NLRTM)",  country:  "Netherlands"  },
{ name:   "Los Angeles (USLAX)",  country:  "United States"  },
{ name:   "Long Beach (USLGB)",  country:  "United States"  },
{ name:   "Charleston (USCHS)",  country:  "United States"  },
{ name:   "Norfolk (USORF)",  country:  "United States"  },
{ name:   "Savannah (USSAV)",  country:  "United States"  },
{ name:   "Mombasa (KEMBA)",  country:  "Kenya"  },
{ name:   "Chicago (USCHI)",  country:  "United States"  },
{ name:   "Buenaventura (COBUN)",  country:  "Colombia"  },
{ name:   "La Spezia (ITSPE)",  country:  "Italy"  },
{ name:   "El Iskandariya (Alexandria (EGALY)",  country:  "Egypt"  },
{ name:   "Houston (USHOU)",  country:  "United States"  },
{ name:   "Ancona (ITAOI)",  country:  "Italy"  },
{ name:   "Laem Chabang (THLCH)",  country:  "Thailand"  },
{ name:   "Vancouver (CAVAN)",  country:  "Canada"  },
{ name:   "Nansha (CNNSA)",  country:  "China"  },
{ name:   "Hamburg (DEHAM)",  country:  "Germany"  },
{ name:   "Oakland (USOAK)",  country:  "United States"  },
{ name:   "Auckland (NZAKL)",  country:  "New Zealand"  },
{ name:   "Le Havre (FRLEH)",  country:  "France"  },
{ name:   "Port Louis (MUPLU)",  country:  "Mauritius"  },
{ name:   "Manila North Harbour (PHMNN)",  country:  "Philippines"  },
{ name:   "Burnie (AUBWT)",  country:  "Australia"  },
{ name:   "Antwerp (BEANR)",  country:  "Belgium"  },
{ name:   "Monrovia (LRMLW)",  country:  "Liberia"  },
{ name:   "Ashdod (ILASH)",  country:  "Israel"  },
{ name:   "Manzanillo (MXZLO)",  country:  "Mexico"  },
{ name:   "Jeddah (SAJED)",  country:  "Saudi Arabia"  },
{ name:   "Lat Krabang (THLKR)",  country:  "Thailand"  },
{ name:   "Dublin (IEDUB)",  country:  "Ireland"  },
{ name:   "Montego Bay (JMMBJ)",  country:  "Jamaica"  },
{ name:   "Sydney (AUSYD)",  country:  "Australia"  },
{ name:   "Casablanca (MACAS)",  country:  "Morocco"  },
{ name:   "Lautoka (FJLTK)",  country:  "Fiji"  },
{ name:   "Napoli (ITNAP)",  country:  "Italy"  },
{ name:   "London Gateway Port (GBLGP)",  country:  "United Kingdom"  },
{ name:   "Mersin (TRMER)",  country:  "Turkey"  },
{ name:   "Bangkok (THBKK)",  country:  "Thailand"  },
{ name:   "Barcelona (ESBCN)",  country:  "Spain"  },
{ name:   "Tripoli (LBKYE)",  country:  "Lebanon"  },
{ name:   "Alger (DZALG)",  country:  "Algeria"  },
{ name:   "Osaka (JPOSA)",  country:  "Japan"  },
{ name:   "Saint Louis, Missouri Rail Ramp (USSTL)",  country:  "United States"  },
{ name:   "Hong Kong (HKHKG)",  country:  "Hong Kong"  },
{ name:   "Melbourne (AUMEL)",  country:  "Australia"  },
{ name:   "Brisbane (AUBNE)",  country:  "Australia"  },
{ name:   "Ad Dammam (SADMM)",  country:  "Saudi Arabia"  },
{ name:   "Cat Lai (VNCLI)",  country:  "Viet Nam"  },
{ name:   "Tokyo (JPTYO)",  country:  "Japan"  },
{ name:   "Luanda (AOLAD)",  country:  "Angola"  },
{ name:   "Chattogram (BDCTG)",  country:  "Bangladesh"  },
{ name:   "Newark (USEWR)",  country:  "United States"  },
{ name:   "Apapa (NGAPP)",  country:  "Nigeria"  },
{ name:   "Constanta (ROCND)",  country:  "Romania"  },
{ name:   "Sharjah (AESHJ)",  country:  "United Arab Emirates"  },
{ name:   "Genova (ITGOA)",  country:  "Italy"  },
{ name:   "Aliaga (TRALI)",  country:  "Turkey"  },
{ name:   "Kingston (JMKIN)",  country:  "Jamaica"  },
{ name:   "Shanghai (CNSHA)",  country:  "China"  },
{ name:   "Larvik (NOLAR)",  country:  "Norway"  },
{ name:   "Trieste (ITTRS)",  country:  "Italy"  },
{ name:   "Tacoma (USTIW)",  country:  "United States"  },
{ name:   "Seattle (USSEA)",  country:  "United States"  },
{ name:   "Minneapolis (USMES)",  country:  "United States"  },
{ name:   "Montreal (CAMTR)",  country:  "Canada"  },
{ name:   "Shuwaikh (KWSWK)",  country:  "Kuwait"  },
{ name:   "Dakar (SNDKR)",  country:  "Senegal"  },
{ name:   "London (GBLON)",  country:  "United Kingdom"  },
{ name:   "Jacksonville (USJAX)",  country:  "United States"  },
{ name:   "Halifax (CAHAL)",  country:  "Canada"  },
{ name:   "Xiamen (CNXMN)",  country:  "China"  },
{ name:   "Sohar (OMSOH)",  country:  "Oman"  },
{ name:   "Durban (ZADUR)",  country:  "South Africa"  },
{ name:   "Fremantle (AUFRE)",  country:  "Australia"  },
{ name:   "Tema (GHTEM)",  country:  "Ghana"  },
{ name:   "Singapore (SGSIN)",  country:  "Singapore"  },
{ name:   "Zhanjiang (CNZHA)",  country:  "China"  },
{ name:   "Yokohama (JPYOK)",  country:  "Japan"  },
{ name:   "Miami (USMIA)",  country:  "United States"  },
{ name:   "Haiphong (VNHPH)",  country:  "Viet Nam"  },
{ name:   "Qingdao (CNTAO)",  country:  "China"  },
{ name:   "Gemlik (TRGEM)",  country:  "Turkey"  },
{ name:   "Kobe (JPUKB)",  country:  "Japan"  },
{ name:   "Maputo (MZMPM)",  country:  "Mozambique"  },
{ name:   "Memphis (USMEM)",  country:  "United States"  },
{ name:   "Port-of-Spain (TTPOS)",  country:  "Trinidad and Tobago"  },
{ name:   "Jakarta, Java (IDJKT)",  country:  "Indonesia"  },
{ name:   "Buenos Aires (ARBUE)",  country:  "Argentina"  },
{ name:   "Southampton (GBSOU)",  country:  "United Kingdom"  },
{ name:   "Fuzhou (CNFOC)",  country:  "China"  },
{ name:   "Tunis (TNTUN)",  country:  "Tunisia"  },
{ name:   "Nagoya, Aichi (JPNGO)",  country:  "Japan"  },
{ name:   "Kota Kinabalu, Sabah (MYBKI)",  country:  "Malaysia"  },
{ name:   "Acajutla (SVAQJ)",  country:  "El Salvador"  },
{ name:   "Gdansk (PLGDN)",  country:  "Poland"  },
{ name:   "Hamad (QAHAM)",  country:  "Qatar"  },
{ name:   "Dar es Salaam (TZDAR)",  country:  "Tanzania, United Republic of"  },
{ name:   "Thessaloniki (GRSKG)",  country:  "Greece"  },
{ name:   "Belfast (GBBEL)",  country:  "United Kingdom"  },
{ name:   "Venezia (ITVCE)",  country:  "Italy"  },
{ name:   "Moji/Kitakyushu (JPMOJ)",  country:  "Japan"  },
{ name:   "Port Klang (MYPKG)",  country:  "Malaysia"  },
{ name:   "Sfax (TNSFA)",  country:  "Tunisia"  },
{ name:   "Ajman (AEAJM)",  country:  "United Arab Emirates"  },
{ name:   "Pecem (BRPEC)",  country:  "Brazil"  },
{ name:   "Xingang (CNXIG)",  country:  "China"  },
{ name:   "Ho Chi Minh City (VNSGN)",  country:  "Viet Nam"  },
{ name:   "Bilbao (ESBIO)",  country:  "Spain"  },
{ name:   "Lazaro Cardenas (MXLZC)",  country:  "Mexico"  },
{ name:   "Port Sudan (SDPZU)",  country:  "Sudan"  },
{ name:   "Poland (USQPD)",  country:  "United States"  },
{ name:   "New Norfolk (AUNLK)",  country:  "Australia"  },
{ name:   "Djibouti (DJJIB)",  country:  "Djibouti"  },
{ name:   "Lome (TGLFW)",  country:  "Togo"  },
{ name:   "Port Everglades (USPEF)",  country:  "United States"  },
{ name:   "Hakata/Fukuoka (JPHKT)",  country:  "Japan"  },
{ name:   "Fos-sur-Mer (FRFOS)",  country:  "France"  },
{ name:   "Varna (BGVAR)",  country:  "Bulgaria"  },
{ name:   "Caucedo (DOCAU)",  country:  "Dominican Republic"  },
{ name:   "Haifa (ILHFA)",  country:  "Israel"  },
{ name:   "Tincan/Lagos (NGTIN)",  country:  "Nigeria"  },
{ name:   "Zeebrugge (BEZEE)",  country:  "Belgium"  },
{ name:   "Oran (DZORN)",  country:  "Algeria"  },
{ name:   "Salalah (OMSLL)",  country:  "Oman"  },
{ name:   "Tianjinxingang (CNTXG)",  country:  "China"  },
{ name:   "Rio Haina (DOHAI)",  country:  "Dominican Republic"  },
{ name:   "Wuhan (CNWUH)",  country:  "China"  },
{ name:   "Piraeus (GRPIR)",  country:  "Greece"  },
{ name:   "Valencia (ESVLC)",  country:  "Spain"  },
{ name:   "General Santos (PHGES)",  country:  "Philippines"  },
{ name:   "Leixoes (PTLEI)",  country:  "Portugal"  },
{ name:   "Santos (BRSSZ)",  country:  "Brazil"  },
{ name:   "Napier (NZNPE)",  country:  "New Zealand"  },
{ name:   "Damietta (EGDAM)",  country:  "Egypt"  },
{ name:   "Livorno (ITLIV)",  country:  "Italy"  },
{ name:   "Fort-de-France (FRFDE)",  country:  "France"  },
{ name:   "Liverpool (GBLIV)",  country:  "United Kingdom"  },
{ name:   "Antalya (TRAYT)",  country:  "Turkey"  },
{ name:   "Penang (MYPEN)",  country:  "Malaysia"  },
{ name:   "Beira (MZBEW)",  country:  "Mozambique"  },
{ name:   "Shimizu (JPSMZ)",  country:  "Japan"  },
{ name:   "Veracruz (MXVER)",  country:  "Mexico"  },
{ name:   "Niigata (JPKIJ)",  country:  "Japan"  },
{ name:   "Navegantes (BRNVT)",  country:  "Brazil"  },
{ name:   "Prince Rupert (CAPRR)",  country:  "Canada"  },
{ name:   "Incheon (KRICH)",  country:  "Korea, Republic of"  },

    
  ];

  for (const port of portsOfDischarge) {
    await prisma.portOfDischarge.upsert({
      where: { name_country: { name: port.name, country: port.country } },
      update: {},
      create: port,
    });
  }
  console.log(`✅ Created ${portsOfDischarge.length} ports of discharge`);

  // Destination Countries
  const destinationCountries = [
    "United States",
    "Germany",
    "United Kingdom",
    "France",
    "Italy",
    "Spain",
    "Netherlands",
    "Belgium",
    "Canada",
    "Australia",
    "New Zealand",
    "Japan",
    "South Korea",
    "Singapore",
    "Malaysia",
    "Thailand",
    "Indonesia",
    "Philippines",
    "Vietnam",
    "India",
    "Bangladesh",
    "Sri Lanka",
    "China",
    "Hong Kong",
    "Taiwan",
    "Brazil",
    "Argentina",
    "Chile",
    "Mexico",
    "South Africa",
    "Egypt",
    "Turkey",
    "Russia",
    "Poland",
    "Sweden",
    "Norway",
    "Denmark",
    "Finland",
    "Switzerland",
    "Austria",
  ];

  for (const countryName of destinationCountries) {
    await prisma.destinationCountry.upsert({
      where: { name: countryName },
      update: {},
      create: { name: countryName },
    });
  }
  console.log(`✅ Created ${destinationCountries.length} destination countries`);

  // Vessels
  const vessels = [
    "MSC Gulsun",
    "HMM Algeciras",
    "MSC Mia",
    "Ever Ace",
    "HMM Oslo",
    "MSC Tessa",
    "Ever Golden",
    "HMM Copenhagen",
    "MSC Rita",
    "Ever Given",
    "CMA CGM Antoine De Saint Exupery",
    "MSC Diana",
    "CMA CGM Champs Elysees",
    "OOCL Hong Kong",
    "Madrid Maersk",
    "COSCO Shipping Universe",
    "CMA CGM Theodore Roosevelt",
    "MSC Oscar",
    "CMA CGM Benjamin Franklin",
    "OOCL Germany",
    "Maersk Triple E Class",
    "CSCL Globe",
    "MOL Triumph",
    "NYK Argus",
    "Evergreen G Class",
    "Yang Ming Excellence",
    "APL Temasek",
    "Hapag-Lloyd Berlin Express",
    "ZIM Integrated",
    "PIL Innovation",
    "Wan Hai 326",
    "X-Press Feeders Vessel",
    "Arkas Aspendos",
    "IRISL Hormuz",
    "K Line Navigator",
    "ONE Stork",
    "Hyundai Brave",
    "Hamburg Sud Cap San Lorenzo",
    "CSAV Valparaiso",
    "Safmarine Nokwanda",
  ];

  for (const vesselName of vessels) {
    await prisma.vessel.upsert({
      where: { name: vesselName },
      update: {},
      create: { name: vesselName },
    });
  }
  console.log(`✅ Created ${vessels.length} vessels`);

  // Organizations
  const organizations = [
    { name: "ABC Trading Co", orgTypes: ["Shipper", "Consignee"] },
    { name: "Global Logistics Ltd", orgTypes: ["Freight Forwarder"] },
    { name: "XYZ Manufacturing", orgTypes: ["Shipper"] },
    { name: "Metro Imports", orgTypes: ["Consignee"] },
    { name: "Prime Exports", orgTypes: ["Shipper", "Exporter"] },
    { name: "Ocean Freight Services", orgTypes: ["Freight Forwarder"] },
    { name: "Continental Trading", orgTypes: ["Shipper", "Consignee"] },
    { name: "Express Cargo Solutions", orgTypes: ["Freight Forwarder"] },
    { name: "International Textiles", orgTypes: ["Shipper", "Manufacturer"] },
    { name: "Tech Components Inc", orgTypes: ["Shipper", "Consignee"] },
    { name: "Green Valley Enterprises", orgTypes: ["Shipper"] },
    { name: "Blue Ocean Logistics", orgTypes: ["Freight Forwarder"] },
    { name: "Sunrise Industries", orgTypes: ["Manufacturer", "Shipper"] },
    { name: "Pacific Rim Trading", orgTypes: ["Consignee", "Importer"] },
    { name: "Northern Lights Corp", orgTypes: ["Shipper", "Exporter"] },
    { name: "Southern Cross Imports", orgTypes: ["Consignee", "Importer"] },
    { name: "Eastern Trade Hub", orgTypes: ["Freight Forwarder"] },
    { name: "Western Logistics", orgTypes: ["Freight Forwarder"] },
    { name: "Central Distribution", orgTypes: ["Consignee", "Distributor"] },
    { name: "Royal Trading House", orgTypes: ["Shipper", "Consignee"] },
    { name: "Modern Cargo Systems", orgTypes: ["Freight Forwarder"] },
    { name: "Elite Shipping Co", orgTypes: ["Shipper"] },
    { name: "Premium Logistics", orgTypes: ["Freight Forwarder"] },
    { name: "Diamond Exports", orgTypes: ["Shipper", "Exporter"] },
    { name: "Platinum Imports", orgTypes: ["Consignee", "Importer"] },
  ];

  for (const org of organizations) {
    const existingOrg = await prisma.organization.findFirst({
      where: { name: org.name },
    });
    
    if (!existingOrg) {
      await prisma.organization.create({
        data: org,
      });
    }
  }
  console.log(`✅ Created ${organizations.length} organizations`);
}

async function createSampleShipmentPlans(userId: string) {
  console.log("🌱 Creating sample shipment plans...");

  const sampleShipmentPlans = [
    {
      data: {
        title: "Electronics Shipment to Europe",
        description: "High-value electronics shipment requiring special handling",
        reference_number: "SP-2024-001",
        shipper: "Tech Components Inc",
        consignee: "European Electronics Ltd",
        notify_party: "Tech Components Inc",
        origin_port: "Shanghai Port",
        destination_port: "Port of Hamburg",
        loading_port: "Shanghai Port", 
        discharge_port: "Port of Hamburg",
        commodity: "Electronics",
        equipment_type: "40ft High Cube Container",
        vessel: "MSC Gulsun",
        voyage: "MS2401E",
        carrier: "MSC Mediterranean Shipping Company",
        booking_status: "CONFIRMED",
        container_movement: [
          {
            container_no: "MSCU1234567",
            seal_no: "SL987654",
            movement_type: "GATE_IN",
            location: "Shanghai Terminal",
            date_time: "2024-06-15T10:30:00Z",
            status: "COMPLETED"
          },
          {
            container_no: "MSCU1234567", 
            seal_no: "SL987654",
            movement_type: "LOADED",
            location: "Shanghai Port",
            date_time: "2024-06-16T14:20:00Z",
            status: "COMPLETED"
          }
        ],
        cargo_details: {
          gross_weight: "15000 kg",
          net_weight: "14200 kg",
          volume: "45 CBM",
          packages: 250,
          package_type: "Cartons",
          dimensions: "2.4m x 2.4m x 2.6m",
          commodity_code: "HS8517"
        },
        shipping_details: {
          etd: "2024-06-17",
          eta: "2024-07-15", 
          transit_time: "28 days",
          route: "Shanghai -> Singapore -> Colombo -> Hamburg",
          service: "AE1 Asia Europe Express"
        },
        commercial_details: {
          incoterms: "FOB Shanghai",
          freight_rate: "$2,450.00",
          currency: "USD",
          payment_terms: "Prepaid",
          bill_of_lading_type: "Ocean B/L"
        },
        special_instructions: [
          "Temperature controlled environment required",
          "Fragile handling - electronic components",
          "Insurance required for full value",
          "Delivery appointment needed"
        ],
        documents: [
          { type: "Commercial Invoice", status: "RECEIVED" },
          { type: "Packing List", status: "RECEIVED" },
          { type: "Certificate of Origin", status: "PENDING" },
          { type: "Export License", status: "RECEIVED" }
        ],
        priority: "HIGH",
        created_by: "John Planner",
        status: "IN_PLANNING"
      },
      userId
    },
    {
      data: {
        title: "Textile Bulk Shipment to USA",
        description: "Large volume textile shipment for retail chain",
        reference_number: "SP-2024-002",
        shipper: "International Textiles",
        consignee: "American Retail Chain",
        notify_party: "Global Logistics Ltd",
        origin_port: "Port of Karachi",
        destination_port: "Port of Los Angeles",
        loading_port: "Port of Karachi",
        discharge_port: "Port of Los Angeles", 
        commodity: "Textiles",
        equipment_type: "40ft Standard Container",
        vessel: "Ever Given",
        voyage: "EG2401W",
        carrier: "Evergreen Marine",
        booking_status: "CONFIRMED",
        container_movement: [
          {
            container_no: "EGHU9876543",
            seal_no: "SL123456",
            movement_type: "STUFFING",
            location: "Karachi Warehouse",
            date_time: "2024-06-10T09:00:00Z",
            status: "COMPLETED"
          },
          {
            container_no: "EGHU9876543",
            seal_no: "SL123456", 
            movement_type: "GATE_IN",
            location: "Karachi Port",
            date_time: "2024-06-11T11:15:00Z",
            status: "COMPLETED"
          },
          {
            container_no: "EGHU9876543",
            seal_no: "SL123456",
            movement_type: "LOADED",
            location: "Karachi Port",
            date_time: "2024-06-12T16:45:00Z", 
            status: "COMPLETED"
          }
        ],
        cargo_details: {
          gross_weight: "18500 kg",
          net_weight: "17800 kg",
          volume: "58 CBM", 
          packages: 420,
          package_type: "Bales",
          dimensions: "2.4m x 2.4m x 2.6m",
          commodity_code: "HS6204"
        },
        shipping_details: {
          etd: "2024-06-13",
          eta: "2024-07-08",
          transit_time: "25 days",
          route: "Karachi -> Dubai -> Singapore -> Los Angeles",
          service: "TP1 Transpacific Express"
        },
        commercial_details: {
          incoterms: "CIF Los Angeles",
          freight_rate: "$3,200.00",
          currency: "USD", 
          payment_terms: "Collect",
          bill_of_lading_type: "Ocean B/L"
        },
        special_instructions: [
          "Standard dry container required",
          "No special handling needed",
          "Regular inspection schedule"
        ],
        documents: [
          { type: "Commercial Invoice", status: "RECEIVED" },
          { type: "Packing List", status: "RECEIVED" },
          { type: "Certificate of Origin", status: "RECEIVED" },
          { type: "Fumigation Certificate", status: "RECEIVED" }
        ],
        priority: "MEDIUM", 
        created_by: "John Planner",
        status: "IN_TRANSIT"
      },
      userId
    },
    {
      data: {
        title: "Pharmaceutical Cold Chain",
        description: "Temperature-sensitive medical supplies requiring cold chain",
        reference_number: "SP-2024-003",
        shipper: "PharmaGlobal Inc",
        consignee: "MedSupply Australia",
        notify_party: "Cold Chain Logistics",
        origin_port: "Singapore Port",
        destination_port: "Port of Sydney",
        loading_port: "Singapore Port",
        discharge_port: "Port of Sydney",
        commodity: "Pharmaceuticals",
        equipment_type: "20ft Refrigerated Container",
        vessel: "OOCL Hong Kong", 
        voyage: "OH2401S",
        carrier: "OOCL Orient Overseas Container Line",
        booking_status: "CONFIRMED",
        container_movement: [
          {
            container_no: "OOLU5555555",
            seal_no: "RF789012",
            movement_type: "REEFER_CONNECT",
            location: "Singapore Cold Storage",
            date_time: "2024-06-08T06:00:00Z",
            status: "COMPLETED",
            temperature: "2°C"
          },
          {
            container_no: "OOLU5555555",
            seal_no: "RF789012",
            movement_type: "GATE_IN", 
            location: "Singapore Port",
            date_time: "2024-06-09T08:30:00Z",
            status: "COMPLETED",
            temperature: "2°C"
          }
        ],
        cargo_details: {
          gross_weight: "8500 kg",
          net_weight: "8000 kg",
          volume: "28 CBM",
          packages: 150,
          package_type: "Thermal Boxes",
          dimensions: "2.4m x 2.4m x 2.6m",
          commodity_code: "HS3004",
          temperature_range: "2°C to 8°C"
        },
        shipping_details: {
          etd: "2024-06-10",
          eta: "2024-06-18",
          transit_time: "8 days", 
          route: "Singapore -> Sydney Direct",
          service: "AS1 Australia Express"
        },
        commercial_details: {
          incoterms: "EXW Singapore",
          freight_rate: "$4,800.00",
          currency: "USD",
          payment_terms: "Prepaid",
          bill_of_lading_type: "Reefer B/L"
        },
        special_instructions: [
          "Maintain 2-8°C throughout journey", 
          "Temperature monitoring required",
          "Priority discharge at destination",
          "24/7 cold chain monitoring",
          "Backup power required"
        ],
        documents: [
          { type: "Commercial Invoice", status: "RECEIVED" },
          { type: "Temperature Certificate", status: "RECEIVED" },
          { type: "Pharmaceutical License", status: "RECEIVED" },
          { type: "Cold Chain Certificate", status: "RECEIVED" }
        ],
        priority: "CRITICAL",
        created_by: "John Planner", 
        status: "IN_TRANSIT"
      },
      userId
    },
    {
      data: {
        title: "Automotive Parts FCL",
        description: "Full container load of automotive spare parts",
        reference_number: "SP-2024-004",
        shipper: "AutoParts Manufacturing",
        consignee: "European Auto Distributors",
        notify_party: "AutoParts Manufacturing",
        origin_port: "Nhava Sheva (JNPT)",
        destination_port: "Port of Antwerp",
        loading_port: "Nhava Sheva (JNPT)",
        discharge_port: "Port of Antwerp",
        commodity: "Automotive Parts",
        equipment_type: "40ft High Cube Container", 
        vessel: "CMA CGM Antoine De Saint Exupery",
        voyage: "CG2401E",
        carrier: "CMA CGM",
        booking_status: "CONFIRMED",
        container_movement: [
          {
            container_no: "CMAU7777777",
            seal_no: "AP345678",
            movement_type: "EMPTY_PICKUP",
            location: "Mumbai Depot",
            date_time: "2024-06-05T10:00:00Z",
            status: "COMPLETED"
          },
          {
            container_no: "CMAU7777777",
            seal_no: "AP345678",
            movement_type: "STUFFING",
            location: "AutoParts Warehouse", 
            date_time: "2024-06-06T14:30:00Z",
            status: "COMPLETED"
          }
        ],
        cargo_details: {
          gross_weight: "22000 kg",
          net_weight: "21200 kg",
          volume: "65 CBM",
          packages: 850,
          package_type: "Mixed Packages",
          dimensions: "2.4m x 2.4m x 2.7m",
          commodity_code: "HS8708"
        },
        shipping_details: {
          etd: "2024-06-08",
          eta: "2024-07-05",
          transit_time: "27 days",
          route: "JNPT -> Colombo -> Suez -> Antwerp", 
          service: "MEX Mediterranean Express"
        },
        commercial_details: {
          incoterms: "FOB Mumbai",
          freight_rate: "$2,950.00",
          currency: "USD",
          payment_terms: "Prepaid",
          bill_of_lading_type: "Ocean B/L"
        },
        special_instructions: [
          "Heavy duty container required",
          "Secure lashing for auto parts",
          "Customs inspection may be required"
        ],
        documents: [
          { type: "Commercial Invoice", status: "RECEIVED" },
          { type: "Packing List", status: "RECEIVED" },
          { type: "Certificate of Origin", status: "RECEIVED" }, 
          { type: "Export Declaration", status: "RECEIVED" }
        ],
        priority: "MEDIUM",
        created_by: "John Planner",
        status: "PLANNING"
      },
      userId
    },
    {
      data: {
        title: "Rice Export LCL Consolidation",
        description: "Less than container load consolidation of premium rice varieties",
        reference_number: "SP-2024-005",
        shipper: "Premium Rice Exports",
        consignee: "Asian Grocery Chain",
        notify_party: "Ocean Freight Services",
        origin_port: "Port of Karachi",
        destination_port: "Port of Hamburg",
        loading_port: "Port of Karachi",
        discharge_port: "Port of Hamburg",
        commodity: "Rice",
        equipment_type: "LCL Consolidation",
        vessel: "Hamburg Sud Cap San Lorenzo", 
        voyage: "HS2401E",
        carrier: "Hapag-Lloyd",
        booking_status: "PENDING",
        container_movement: [
          {
            container_no: "HLBU3333333",
            seal_no: "RC901234",
            movement_type: "CFS_STUFFING",
            location: "Karachi CFS",
            date_time: "2024-06-20T09:00:00Z",
            status: "PLANNED"
          }
        ],
        cargo_details: {
          gross_weight: "8500 kg",
          net_weight: "8000 kg",
          volume: "12 CBM",
          packages: 200,
          package_type: "PP Bags",
          dimensions: "Various sizes",
          commodity_code: "HS1006"
        },
        shipping_details: {
          etd: "2024-06-22", 
          eta: "2024-07-20",
          transit_time: "28 days",
          route: "Karachi -> Dubai -> Hamburg",
          service: "ME2 Middle East Express"
        },
        commercial_details: {
          incoterms: "CFR Hamburg",
          freight_rate: "$1,250.00",
          currency: "USD",
          payment_terms: "Collect",
          bill_of_lading_type: "House B/L"
        },
        special_instructions: [
          "Food grade container required",
          "Fumigation certificate needed",
          "No contamination with other cargo"
        ],
        documents: [
          { type: "Commercial Invoice", status: "PENDING" },
          { type: "Phytosanitary Certificate", status: "PENDING" }, 
          { type: "Certificate of Origin", status: "PENDING" },
          { type: "Quality Certificate", status: "PENDING" }
        ],
        priority: "LOW",
        created_by: "John Planner",
        status: "DRAFT"
      },
      userId
    }
  ];

  for (const planData of sampleShipmentPlans) {
    await prisma.shipmentPlan.create({
      data: planData,
    });
  }

  console.log(`✅ Created ${sampleShipmentPlans.length} sample shipment plans`);
}

async function createSampleLinerBookings(userId: string) {
  console.log("🌱 Creating sample liner bookings...");

  const sampleLinerBookings = [
    {
      data: {
        booking_reference: "LB-2024-001",
        status: "CONFIRMED",
        shipper: "Global Electronics Ltd",
        consignee: "European Tech Distributors",
        notify_party: "Global Electronics Ltd",
        commodity: "Electronics",
        equipment_type: "40ft High Cube Container",
        quantity: 2,
        vessel: "MSC Gulsun",
        voyage: "MS2401E",
        carrier: "MSC Mediterranean Shipping Company",
        service: "AE1 Asia Europe Express",
        loading_port: "Shanghai Port",
        discharge_port: "Port of Hamburg",
        place_of_receipt: "Shanghai Warehouse",
        place_of_delivery: "Hamburg Terminal",
        cargo_details: {
          description: "Electronic Components and Devices",
          commodity_code: "HS8517",
          gross_weight: "30000 kg",
          volume: "90 CBM",
          packages: 500,
          package_type: "Cartons",
          dangerous_goods: false
        },
        schedule: {
          cargo_cutoff: "2024-06-15T12:00:00Z",
          document_cutoff: "2024-06-15T15:00:00Z", 
          etd: "2024-06-17T18:00:00Z",
          eta: "2024-07-15T08:00:00Z",
          transit_time: "28 days"
        },
        rates: {
          ocean_freight: "$4900.00",
          currency: "USD",
          payment_terms: "Prepaid",
          rate_validity: "2024-06-30",
          fuel_surcharge: "$245.00",
          security_fee: "$25.00",
          documentation_fee: "$50.00"
        },
        commercial_terms: {
          incoterms: "FOB Shanghai",
          freight_prepaid: true,
          bill_of_lading_type: "Original",
          release_type: "Original B/L"
        },
        special_requirements: [
          "Temperature monitoring preferred",
          "Careful handling required", 
          "Insurance recommended"
        ],
        contacts: {
          shipper_contact: {
            name: "Zhang Wei",
            email: "zhang.wei@globalelectronics.com",
            phone: "+86-21-12345678"
          },
          consignee_contact: {
            name: "Hans Mueller",
            email: "h.mueller@eurotech.de",
            phone: "+49-40-87654321"
          }
        },
        created_by: "Sarah Booking",
        booking_date: "2024-06-01T10:30:00Z",
        validity_date: "2024-06-30T23:59:59Z"
      },
      userId
    },
    {
      data: {
        booking_reference: "LB-2024-002",
        status: "PENDING", 
        shipper: "Textile Exporters Inc",
        consignee: "American Fashion Retail",
        notify_party: "Blue Ocean Logistics",
        commodity: "Textiles",
        equipment_type: "40ft Standard Container",
        quantity: 3,
        vessel: "Ever Ace",
        voyage: "EA2401W",
        carrier: "Evergreen Marine",
        service: "TP1 Transpacific Express",
        loading_port: "Port of Karachi",
        discharge_port: "Port of Los Angeles",
        place_of_receipt: "Karachi Textile Hub",
        place_of_delivery: "LA Distribution Center",
        cargo_details: {
          description: "Cotton Textiles and Garments",
          commodity_code: "HS6204",
          gross_weight: "55500 kg", 
          volume: "174 CBM",
          packages: 1260,
          package_type: "Bales",
          dangerous_goods: false
        },
        schedule: {
          cargo_cutoff: "2024-06-22T14:00:00Z",
          document_cutoff: "2024-06-22T17:00:00Z",
          etd: "2024-06-24T20:00:00Z",
          eta: "2024-07-19T06:00:00Z",
          transit_time: "25 days"
        },
        rates: {
          ocean_freight: "$9600.00",
          currency: "USD",
          payment_terms: "Collect",
          rate_validity: "2024-07-15",
          fuel_surcharge: "$480.00",
          security_fee: "$75.00",
          documentation_fee: "$75.00"
        },
        commercial_terms: {
          incoterms: "CIF Los Angeles", 
          freight_prepaid: false,
          bill_of_lading_type: "Original",
          release_type: "Telex Release"
        },
        special_requirements: [
          "Fumigation required",
          "Standard dry containers",
          "Regular inspection schedule"
        ],
        contacts: {
          shipper_contact: {
            name: "Ahmed Hassan",
            email: "a.hassan@textileexporters.pk",
            phone: "+92-21-98765432"
          },
          consignee_contact: {
            name: "Jennifer Smith",
            email: "j.smith@americanfashion.com",
            phone: "+1-310-55544433"
          }
        },
        created_by: "Sarah Booking",
        booking_date: "2024-06-05T14:20:00Z", 
        validity_date: "2024-07-15T23:59:59Z"
      },
      userId
    },
    {
      data: {
        booking_reference: "LB-2024-003",
        status: "CANCELLED",
        shipper: "Chemical Industries Corp",
        consignee: "European Chemical Supplies",
        notify_party: "Chemical Industries Corp",
        commodity: "Chemicals",
        equipment_type: "20ft Tank Container",
        quantity: 1,
        vessel: "CMA CGM Benjamin Franklin",
        voyage: "BF2401E",
        carrier: "CMA CGM",
        service: "FAL French Asia Line",
        loading_port: "Dubai Port",
        discharge_port: "Port of Le Havre", 
        place_of_receipt: "Dubai Chemical Terminal",
        place_of_delivery: "Le Havre Chemical Hub",
        cargo_details: {
          description: "Industrial Chemical Solutions",
          commodity_code: "HS2815",
          gross_weight: "24000 kg",
          volume: "20 CBM",
          packages: 1,
          package_type: "Tank Container",
          dangerous_goods: true,
          un_number: "UN1830",
          hazard_class: "8"
        },
        schedule: {
          cargo_cutoff: "2024-06-18T10:00:00Z",
          document_cutoff: "2024-06-18T16:00:00Z",
          etd: "2024-06-20T22:00:00Z",
          eta: "2024-07-12T14:00:00Z",
          transit_time: "22 days"
        },
        rates: {
          ocean_freight: "$3200.00", 
          currency: "USD",
          payment_terms: "Prepaid",
          rate_validity: "2024-07-01",
          fuel_surcharge: "$160.00",
          security_fee: "$40.00",
          documentation_fee: "$100.00",
          dangerous_goods_surcharge: "$500.00"
        },
        commercial_terms: {
          incoterms: "EXW Dubai",
          freight_prepaid: true,
          bill_of_lading_type: "Original",
          release_type: "Original B/L"
        },
        special_requirements: [
          "Dangerous goods certified container",
          "Special handling procedures",
          "Emergency response plan required",
          "IMDG Code compliance mandatory"
        ],
        contacts: {
          shipper_contact: {
            name: "Mohammed Al-Rashid", 
            email: "m.alrashid@chemicalcorp.ae",
            phone: "+971-4-11223344"
          },
          consignee_contact: {
            name: "Pierre Dubois",
            email: "p.dubois@eurochemicals.fr",
            phone: "+33-2-99887766"
          }
        },
        created_by: "Sarah Booking",
        booking_date: "2024-06-03T11:45:00Z",
        validity_date: "2024-07-01T23:59:59Z",
        cancellation_reason: "Shipper request due to delayed production",
        cancelled_date: "2024-06-10T09:30:00Z"
      },
      userId
    },
    {
      data: {
        booking_reference: "LB-2024-004",
        status: "CONFIRMED",
        shipper: "Fresh Produce Exporters", 
        consignee: "Asian Supermarket Chain",
        notify_party: "Cold Chain Logistics",
        commodity: "Fresh Fruits",
        equipment_type: "40ft Refrigerated Container",
        quantity: 2,
        vessel: "NYK Argus",
        voyage: "NY2401A",
        carrier: "NYK Nippon Yusen Kabushiki Kaisha",
        service: "AS1 Australia Express",
        loading_port: "Port of Melbourne",
        discharge_port: "Singapore Port",
        place_of_receipt: "Melbourne Fresh Market",
        place_of_delivery: "Singapore Cold Storage",
        cargo_details: {
          description: "Premium Australian Fruits",
          commodity_code: "HS0804",
          gross_weight: "36000 kg",
          volume: "70 CBM",
          packages: 1800,
          package_type: "Cartons", 
          dangerous_goods: false,
          temperature_required: "0°C to 4°C"
        },
        schedule: {
          cargo_cutoff: "2024-06-25T08:00:00Z",
          document_cutoff: "2024-06-25T12:00:00Z",
          etd: "2024-06-26T16:00:00Z",
          eta: "2024-07-02T10:00:00Z",
          transit_time: "6 days"
        },
        rates: {
          ocean_freight: "$7200.00",
          currency: "USD",
          payment_terms: "Prepaid",
          rate_validity: "2024-07-31",
          fuel_surcharge: "$360.00",
          security_fee: "$50.00",
          documentation_fee: "$60.00",
          reefer_surcharge: "$800.00"
        },
        commercial_terms: {
          incoterms: "FOB Melbourne",
          freight_prepaid: true, 
          bill_of_lading_type: "Original",
          release_type: "Express Release"
        },
        special_requirements: [
          "Continuous cold chain maintenance",
          "Pre-cooling required before loading",
          "Temperature monitoring throughout",
          "Priority discharge at destination",
          "Fresh produce handling certified"
        ],
        contacts: {
          shipper_contact: {
            name: "Robert Johnson",
            email: "r.johnson@freshproduce.au",
            phone: "+61-3-87654321"
          },
          consignee_contact: {
            name: "Lim Wei Ming",
            email: "w.lim@asiansupermarket.sg",
            phone: "+65-6-12345678"
          }
        },
        created_by: "Sarah Booking",
        booking_date: "2024-06-08T16:15:00Z", 
        validity_date: "2024-07-31T23:59:59Z"
      },
      userId
    },
    {
      data: {
        booking_reference: "LB-2024-005",
        status: "SPACE_CONFIRMED",
        shipper: "Steel Manufacturing Co",
        consignee: "Construction Materials Ltd",
        notify_party: "Heavy Cargo Logistics",
        commodity: "Steel Products",
        equipment_type: "40ft Flat Rack Container",
        quantity: 4,
        vessel: "COSCO Shipping Universe",
        voyage: "CS2401P",
        carrier: "COSCO Shipping Lines",
        service: "CP1 China Pacific",
        loading_port: "Qingdao Port",
        discharge_port: "Port of Vancouver",
        place_of_receipt: "Qingdao Steel Mill",
        place_of_delivery: "Vancouver Steel Yard", 
        cargo_details: {
          description: "Heavy Steel Beams and Structures",
          commodity_code: "HS7216",
          gross_weight: "96000 kg",
          volume: "120 CBM",
          packages: 48,
          package_type: "Steel Bundles",
          dangerous_goods: false,
          special_handling: "Heavy lift required"
        },
        schedule: {
          cargo_cutoff: "2024-07-01T16:00:00Z",
          document_cutoff: "2024-07-02T10:00:00Z",
          etd: "2024-07-03T14:00:00Z",
          eta: "2024-07-15T20:00:00Z",
          transit_time: "12 days"
        },
        rates: {
          ocean_freight: "$12800.00",
          currency: "USD",
          payment_terms: "Collect",
          rate_validity: "2024-08-15", 
          fuel_surcharge: "$640.00",
          security_fee: "$100.00",
          documentation_fee: "$80.00",
          heavy_lift_surcharge: "$2000.00"
        },
        commercial_terms: {
          incoterms: "CFR Vancouver",
          freight_prepaid: false,
          bill_of_lading_type: "Original",
          release_type: "Original B/L"
        },
        special_requirements: [
          "Heavy lift crane required for loading",
          "Specialized lashing and securing",
          "Weight distribution certificate needed",
          "Port handling equipment coordination",
          "Overweight permit may be required"
        ],
        contacts: {
          shipper_contact: {
            name: "Li Chen",
            email: "l.chen@steelmanufacturing.cn", 
            phone: "+86-532-22334455"
          },
          consignee_contact: {
            name: "David Thompson",
            email: "d.thompson@constructionmaterials.ca",
            phone: "+1-604-99887766"
          }
        },
        created_by: "Sarah Booking",
        booking_date: "2024-06-12T13:20:00Z",
        validity_date: "2024-08-15T23:59:59Z"
      },
      userId
    }
  ];

  for (const bookingData of sampleLinerBookings) {
    await prisma.linerBooking.create({
      data: bookingData,
    });
  }

  console.log(`✅ Created ${sampleLinerBookings.length} sample liner bookings`);
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
