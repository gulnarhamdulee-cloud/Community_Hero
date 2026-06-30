import { Report } from './types';

export const SEED_REPORTS: Report[] = [
  {
    id: "seed-report-1",
    title: "Hazardous Deep Potholes near Metro Pillar 124",
    description: "Multiple severe potholes have formed right under the Metro station stairs on 100 Feet Road. Two-wheelers are skidding constantly at night trying to maneuver around them. The road base is entirely eroded.",
    category: "Roads & Traffic",
    subCategory: "Complex Potholes / Damaged Road Structure",
    severity: "Critical",
    severityJustification: "Potholes are located right in the main traffic lane near a busy metro descent point, causing extreme skid hazards for two-wheelers and severe traffic bottlenecks.",
    suggestedDepartment: "Bruhat Bengaluru Mahanagara Palike (BBMP) Street Infrastructure division",
    status: "In-Progress",
    location: {
      lat: 12.9716,
      lng: 77.5946,
      city: "Bengaluru",
      address: "Metro Pillar 124, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038"
    },
    imageUrl: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
    complaintDraftEnglish: `To,
The Assistant Commissioner / Ward Officer,
Indiranagar Division, Bruhat Bengaluru Mahanagara Palike (BBMP)
Bengaluru, Karnataka

Subject: Urgent Request to Rectify Extremely Hazardous Potholes at 100 Feet Road

Respected Sir/Ma'am,

I am writing to draw your urgent attention to the highly hazardous potholes that have emerged directly beneath Metro Pillar 124 on Indiranagar 100 Feet Road. 

Due to recent heavy showers, the bitumen coating is completely eroded, exposing a deep crater approximately 1.5 feet deep. At least four two-wheelers were observed skidding significantly over the past 48 hours, especially after sunset due to poor streetlighting conditions nearby. This is a critical risk to citizen life and vehicle safety.

Under Section 58 of the Karnataka Municipal Corporations Act, public street maintenance is an obligatory duty of the corporation. We request your engineering department to immediately deploy emergency cold-patching or hot-mix laying teams to fill these craters.

Thanking you.
Yours Faithfully,
Citizens of Indiranagar Ward`,
    complaintDraftHindi: `सेवा में,
सहायक आयुक्त / वार्ड अधिकारी,
इंदिरा नगर प्रभाग, बृहत बेंगलुरु महानगर पालिका (BBMP)
बेंगलुरु, कर्नाटक

विषय: इंदिरा नगर 100 फीट रोड पर अत्यधिक खतरनाक गड्ढों को ठीक करने का तत्काल अनुरोध।

महोदय/महोदया,

मैं आपका ध्यान इंदिरा नगर 100 फीट रोड पर मेट्रो पिलर 124 के ठीक नीचे बने बेहद खतरनाक गड्ढों की ओर आकर्षित करना चाहता हूँ।

हाल ही में हुई भारी बारिश के कारण, सड़क का डामर पूरी तरह से बह गया है, जिससे लगभग 1.5 फीट गहरा गड्ढा हो गया है। पिछले 48 घंटों में कई दोपहिया वाहन यहाँ फिसलने से बाल-बाल बचे हैं, खासकर शाम के बाद जहाँ दृश्यता काफी कम हो जाती है। यह नागरिकों के जीवन के लिए एक गंभीर खतरा है।

कर्नाटक नगर निगम अधिनियम की धारा 58 के तहत, सड़कों का उचित रख-रखाव निगम का अनिवार्य कर्तव्य है। हम अनुरोध करते हैं कि सुरक्षा को प्राथमिकता देते हुए यहाँ तत्काल पैचवर्क कार्य कराया जाए।

धन्यवाद।
भवदीय,
इंदिरा नगर वार्ड के जागरूक नागरिक`,
    civicAdvice: "Please avoid speeding near Metro Pillar 124. Volunteers have placed temporary warning cones and red tape around the biggest crater.",
    upvotesCount: 42,
    upvotesUsers: ["user1", "user2", "user3"],
    createdAt: "2026-06-20T10:30:00Z",
    userId: "system-seed",
    userEmail: "officer@communityhero.in",
    userName: "BBMP Citizen Forum",
    resolvedAt: null
  },
  {
    id: "seed-report-2",
    title: "Major Garbage Dump Accumulation & Toxic Waste Burning",
    description: "Huge uncollected garbage pile at Dadar West near the vegetable market. Vendors are throwing plastic bags, and recently someone attempted to set the pile on fire, releasing thick, toxic yellow smoke.",
    category: "Solid Waste Management",
    subCategory: "Garbage Dump Overflowing",
    severity: "Severe",
    severityJustification: "Accumulation consists of organic and non-biodegradable plastics. Burning of municipal waste releases highly toxic substances (dioxins), violating National Green Tribunal (NGT) clean air parameters.",
    suggestedDepartment: "Brihanmumbai Municipal Corporation (BMC) G/North Solid Waste Management Division",
    status: "Resolved",
    location: {
      lat: 19.0178,
      lng: 72.8478,
      city: "Mumbai",
      address: "Senapati Bapat Marg, Dadar West, Mumbai, Maharashtra 400028"
    },
    imageUrl: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80",
    complaintDraftEnglish: `To,
The Ward Officer (G/North Ward),
Brihanmumbai Municipal Corporation (BMC)
Mumbai, Maharashtra

Subject: Grievance Against Chronic Waste Accumulation and Illegal Open Burning near Dadar Station

Respected Sir/Ma'am,

We wish to bring to your immediate notice the terrible state of solid waste contamination on Senapati Bapat Marg, adjacent to the Dadar West vegetable market.

A permanent litter dump has formed, and civic clearance trucks cover it only once a week. Toxic plastic vapors have engulfed nearby resident clusters since local laborers set standard piles on fire to clear volume. This violates the Solid Waste Management Rules 2016 and the central guidelines on air pollution.

We demand:
1. Daily clearance by your waste collection vehicles.
2. Installation of CCTV cameras to penalize illicit dumpers.

Thanking you.
Yours Faithfully,
Dadar West Residents Welfare Association`,
    complaintDraftHindi: `सेवा में,
वार्ड अधिकारी (जी/उत्तर वार्ड),
बृहन्मुंबई नगर निगम (BMC)
मुंबई, महाराष्ट्र

विषय: दादर स्टेशन के पास कचरा संचय और अवैध कचरा जलाने के खिलाफ शिकायत।

महोदय/महोदया,

हम दादर पश्चिम सब्जी मंडी के पास सेनापति बापट मार्ग पर ठोस कचरे के गंभीर संचय की ओर आपका ध्यान आकर्षित करना चाहते हैं।

यहाँ कचरे का एक स्थायी ढेर बन गया है जिसे सप्ताह में केवल एक बार ही साफ किया जाता है। स्थानीय असामाजिक तत्वों द्वारा कचरा जलाने की वजह से हानिकारक धुआं फैल रहा है जो स्वास्थ्य के लिए घातक है। यह ठोस अपशिष्ट प्रबंधन नियम 2016 का सीधा उल्लंघन है।

हमारी मांग है:
1. कचरा संग्रह वाहनों द्वारा दैनिक सफाई की व्यवस्था हो।
2. अवैध कचरा फेंकने वालों पर नजर रखने के लिए सीसीटीवी कैमरे लगाए जाएं।

धन्यवाद।
भवदीय,
दादर पश्चिम निवासी संघ`,
    civicAdvice: "BMC Solid Waste truck cleared the dump. A local volunteer has painted the spot with traditional rangoli to discourage future trash throwing!",
    upvotesCount: 88,
    upvotesUsers: [],
    createdAt: "2026-06-18T14:15:00Z",
    userId: "system-seed",
    userEmail: "mumbai_clean@gmail.com",
    userName: "Mumbai Clean-Up Drive",
    resolvedAt: "2026-06-21T18:00:00Z"
  },
  {
    id: "seed-report-3",
    title: "Non-Functional High-Mast Streetlights on Outer Ring Road Expressway",
    description: "The entire corridor of 8 high-mast streetlights leading from the bypass flyover to Sector 4 is pitch black. This has become an extremely dark, isolated zone for pedestrians returning from work late at night.",
    category: "Electricity & Illumination",
    subCategory: "Defective Streetlight Column",
    severity: "Severe",
    severityJustification: "An expressway dark spot reduces safe driver recognition distance and creates safety issues for female commuters walking back from outer corporate business parks.",
    suggestedDepartment: "Municipal Corporation of Delhi (MCD) Electric Engineering Department",
    status: "Reported",
    location: {
      lat: 28.6139,
      lng: 77.2090,
      city: "Delhi",
      address: "Bypass Flyover Approach, Sector 4, Outer Ring Road, New Delhi, Delhi 110016"
    },
    imageUrl: "https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=600&q=80",
    complaintDraftEnglish: `To,
The Superintending Engineer (Electrical),
Municipal Corporation of Delhi (MCD)
New Delhi

Subject: Complaint Regarding Persistent Non-Functioning of Heavy High-Mast Streetlights

Respected Sir,

This is to lodge a formal complaint on the complete darkness prevailing along the Outer Ring Road Sector 4 Bypass underpass for the last 10 days. 

Eight major LED streetlight panels on structural pillars are completely offline, likely due to a underground cabling short-circuit during last week's storms. Vehicles travel at 80 km/h here and the extreme darkness has already resulted in minor rear-end collisions. Pedestrians, particularly women, feel highly vulnerable.

Prompt repair of lighting is governed strictly under MCD central guidelines. We request you to direct your electrical grid technicians to check the service cables.

Thanking you.
Yours Faithfully,
Delhi Citizen Guild`,
    complaintDraftHindi: `सेवा में,
अधीक्षण अभियंता (विद्युत),
दिल्ली नगर निगम (MCD)
नई दिल्ली

विषय: भारी हाई-मास्ट पोल स्ट्रीटलाइट्स के पूरी तरह से बंद होने के संबंध में शिकायत।

महोदय,

यह पिछले 10 दिनों से आउटर रिंग रोड सेक्टर 4 बाईपास अंडरपास के साथ पूरी सड़क पर छाए रहने वाले घने अंधेरे के संबंध में एक औपचारिक शिकायत दर्ज करने के लिए है।

विद्युत खंभों पर स्थापित आठ प्रमुख एलईडी पैनल पूरी तरह से बंद हैं। यहाँ वाहन 80 किलोमीटर प्रति घंटे की गति से चलते हैं और अंधेरे के कारण सुरक्षा को गंभीर खतरा पैदा हो गया है। देर रात काम से लौटने वाले लोग काफी असुरक्षित महसूस करते हैं।

कृपया तत्काल हमारी विद्युत ग्रिड की मरम्मत कराएं।

धन्यवाद।
भवदीय,
दिल्ली सिटीजन गिल्ड`,
    civicAdvice: "Please avoid taking the flyover shoulder on foot. Keep your vehicle hazard lights flashing while taking the bypass turn.",
    upvotesCount: 29,
    upvotesUsers: [],
    createdAt: "2026-06-22T08:12:00Z",
    userId: "system-seed",
    userEmail: "delhicommunity@outlook.com",
    userName: "Capital City Vigilants",
    resolvedAt: null
  },
  {
    id: "seed-report-4",
    title: "Broken Drinking Water Pipeline and Severe Drinking Water Leakage",
    description: "Main municipal fresh drinking water pipe has burst. Thousand of liters of water are shooting into the air and gushing down the road. Local residential block has dry taps and sewage is seeping back due to low pressure.",
    category: "Water & Sanitation",
    subCategory: "Sewer Water Leakage / Closed Drains",
    severity: "Critical",
    severityJustification: "Massive volumetric loss of treated drinking water alongside dry state for major blocks and contamination of domestic supply lines through soil suction.",
    suggestedDepartment: "Pune Municipal Corporation (PMC) Water Supply & Sewerage Board",
    status: "In-Review",
    location: {
      lat: 18.5204,
      lng: 73.8567,
      city: "Pune",
      address: "Lane 5, Near Jogging Park, Koregaon Park, Pune, Maharashtra 411001"
    },
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80",
    complaintDraftEnglish: `To,
The Chief Engineer,
Water Supply & Sanitation Department, Pune Municipal Corporation (PMC)
Pune, Maharashtra

Subject: Immediate Request to plug massive municipal fresh water burst pipeline in Koregaon Park

Respected Sir,

I write containing deep civic alarm concerning a primary municipal supply mainline pipe rupture this morning at Lane 5, Koregaon Park.

A water column is shooting 10 feet high, flooding neighboring basements and draining clean water reservoirs. Four blocks are experiencing complete zero-pressure dry taps. If not shut down and welded instantly, thousands of cubic meters of purified municipal water will be wasted and water lines will suffer back-flow suction contamination.

We urge an immediate maintenance crew deployment to shut the G-valve and start repair layout.

Thanking you.
Yours Sincerely,
Pune Civic Action Forum`,
    complaintDraftHindi: `सेवा में,
मुख्य अभियंता,
जल आपूर्ति एवं स्वच्छता विभाग, पुणे नगर निगम (PMC)
पुणे, महाराष्ट्र

विषय: कोरेगांव पार्क में मुख्य पेय जल पाइपलाइन के फटने के संबंध में अति त्वरित शिकायत।

महोदय,

मैं आज सुबह कोरेगांव पार्क के लेन 5 में मुख्य निगम जल आपूर्ति पाइप फटने के संबंध में गंभीर चिंता व्यक्त करने हेतु लिख रहा हूँ।

हजारों लीटर स्वच्छ जल पूरी सड़क पर बह रहा है जिससे आस-पास की सोसायटियों के बेसमेंट में पानी भर गया है। निवासियों के नलों में पानी आना बंद हो गया है। अगर इसे तुरंत ठीक नहीं किया गया, तो गंभीर जल संकट उत्पन्न हो जाएगा।

हम अनुरोध करते हैं कि मरम्मत करने वाली टीम को तुरंत भेजा जाए।

धन्यवाद।
भवदीय,
पुणे सिटीजन फोरम`,
    civicAdvice: "PMC Ward Engineer confirmed they are closing the supply gate valve. Please stock buckets with alternate delivery tankers.",
    upvotesCount: 97,
    upvotesUsers: [],
    createdAt: "2026-06-23T06:05:00Z",
    userId: "system-seed",
    userEmail: "pune_residents@gmail.com",
    userName: "Pune Civic Action Forum",
    resolvedAt: null
  }
];
