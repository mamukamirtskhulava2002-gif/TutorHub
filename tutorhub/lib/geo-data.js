// საქართველოს გეოგრაფიული იერარქია: რეგიონი → მუნიციპალიტეტი → სოფელი/უბანი
// lat/lng — მუნიციპალიტეტის ცენტრი (ახლო-მდებარე ძებნისთვის)

export const REGIONS = [
  {
    id: "tbilisi",
    name: "თბილისი",
    lat: 41.6938, lng: 44.8015,
    municipalities: [
      {
        id: "tbilisi_city", name: "თბილისი", lat: 41.6938, lng: 44.8015,
        villages: [
          "ვაკე","საბურთალო","ისანი","სამგორი","ნაძალადევი","ჩუღურეთი",
          "დიდუბე","გლდანი","კრწანისი","მთაწმინდა","ავლაბარი","ვარკეთილი",
          "დიღომი","ლილო","ავჭალა","ნახალოვკა","ბაგები","ორთაჭალა",
          "გიგლო","წავკისი","თხინვალა","ბეთანია","კიკეთი","ტაბახმელა",
          "კოჯორი","შინდისი","ოქროყანა","ლოტკინი","ნორიო"
        ]
      }
    ]
  },
  {
    id: "kakheti",
    name: "კახეთი",
    lat: 41.8000, lng: 45.5000,
    municipalities: [
      {
        id: "telavi", name: "თელავი", lat: 41.9186, lng: 45.4733,
        villages: ["თელავი","ნაფარეული","ვარდისუბანი","კახი","ვეჯინი",
          "ართანა","ბაისუბანი","ჭიაური","ზინობიანი","ნასტასის","ჯიმითი"]
      },
      {
        id: "akhmeta", name: "ახმეტა", lat: 42.0278, lng: 45.2092,
        villages: ["ახმეტა","შილდა","ომალო","მატანი","ბაცრალა","ჩონთიო",
          "ილურთა","ალვანი","ართანა","ძველი ახმეტა"]
      },
      {
        id: "gurjaani", name: "გურჯაანი", lat: 41.7462, lng: 45.7920,
        villages: ["გურჯაანი","ვაზისუბანი","ჩუმლაყი","ვეჯინი","კოლაგი",
          "ბოდბის ხევი","ვაჩნაძიანი","ნინოწმინდა (კახ.)"]
      },
      {
        id: "lagodekhi", name: "ლაგოდეხი", lat: 41.8278, lng: 46.2844,
        villages: ["ლაგოდეხი","ლელიანი","კაბალი","ჩიაური","გიორგეთი","ლელი","ჩობანქარი"]
      },
      {
        id: "sighnaghi", name: "სიღნაღი", lat: 41.6216, lng: 45.9218,
        villages: ["სიღნაღი","ბოდბე","ჩაგელი","ნუკრიანი","ანაგა","კარდენახი","ვაქირი"]
      },
      {
        id: "kvareli", name: "ყვარელი", lat: 41.9573, lng: 45.8124,
        villages: ["ყვარელი","შილდა","გავაზი","ახალსოფელი","ივლიანი","ლალა"]
      },
      {
        id: "sagarejo", name: "საგარეჯო", lat: 41.7313, lng: 45.3323,
        villages: ["საგარეჯო","გომბორი","პატარდღვარი","კოჭბაანი","ნინოწმინდა (საგ.)","ნინოთი"]
      },
      {
        id: "dedoplistskaro", name: "დედოფლისწყარო", lat: 41.4682, lng: 46.1055,
        villages: ["დედოფლისწყარო","მატანი","კაბალი","ყარაჯალა","თულარი"]
      }
    ]
  },
  {
    id: "shida_kartli",
    name: "შიდა ქართლი",
    lat: 41.9500, lng: 44.0000,
    municipalities: [
      {
        id: "gori", name: "გორი", lat: 41.9862, lng: 44.1127,
        villages: ["გორი","ავნევი","ვარიანი","ატენი","სარგვალი","ბებნისი",
          "ტყვიავი","კეხვი","ხშისი","ნიქოზი","ბერბუკი","ქსოვრისი"]
      },
      {
        id: "kaspi", name: "კასპი", lat: 41.8948, lng: 44.4176,
        villages: ["კასპი","ძევრი","ნიქოზი","ხოვლე","ბრეთი","გორისჯვარი","რეხა"]
      },
      {
        id: "khashuri", name: "ხაშური", lat: 41.9942, lng: 43.6074,
        villages: ["ხაშური","სურამი","ციხისჯვარი","ნარეკვავი","ერედვი","ქვახვრელი"]
      },
      {
        id: "kareli", name: "ქარელი", lat: 41.8498, lng: 44.0280,
        villages: ["ქარელი","კოდისი","ახალქალაქი","სამთავისი","ახალციხე (შ.ქ.)","ბოშური"]
      },
      {
        id: "chinvali", name: "ცხინვალი", lat: 42.2264, lng: 43.9720,
        villages: ["ცხინვალი","ავნევი","ნიქოზი"]
      }
    ]
  },
  {
    id: "kvemo_kartli",
    name: "ქვემო ქართლი",
    lat: 41.4500, lng: 44.9500,
    municipalities: [
      {
        id: "rustavi", name: "რუსთავი", lat: 41.5481, lng: 44.9870,
        villages: ["რუსთავი","ბოლნისი","კამარლო"]
      },
      {
        id: "bolnisi", name: "ბოლნისი", lat: 41.4498, lng: 44.5308,
        villages: ["ბოლნისი","ქვეში","ბრდაძორი","დამია","ქვემო სადახლო","კლდეისი"]
      },
      {
        id: "gardabani", name: "გარდაბანი", lat: 41.4576, lng: 45.0860,
        villages: ["გარდაბანი","კრწანისი","ახალი სოფელი","კეთილი","ნაღვარევი","ყარაჯა"]
      },
      {
        id: "marneuli", name: "მარნეული", lat: 41.4857, lng: 44.7917,
        villages: ["მარნეული","ქვემო სარალი","კაფანახჩი","სადახლო","ბაიდარი"]
      },
      {
        id: "dmanisi", name: "დმანისი", lat: 41.3275, lng: 44.1975,
        villages: ["დმანისი","მასავერა","ბრეთი","ოდება"]
      },
      {
        id: "tetritskaro", name: "თეთრიწყარო", lat: 41.5402, lng: 44.4629,
        villages: ["თეთრიწყარო","ოდება","ბები","ირია"]
      },
      {
        id: "tsalka", name: "წალკა", lat: 41.2831, lng: 44.0968,
        villages: ["წალკა","ხატისოფელი","ტალავერი","მანგლისი"]
      },
      {
        id: "ninotsminda_kk", name: "ნინოწმინდა (ქ.ქ.)", lat: 41.2076, lng: 43.7316,
        villages: ["ნინოწმინდა","გომარეთი","თოხლიაური"]
      }
    ]
  },
  {
    id: "mtskheta_mtianeti",
    name: "მცხეთა-მთიანეთი",
    lat: 42.0000, lng: 44.7000,
    municipalities: [
      {
        id: "mtskheta", name: "მცხეთა", lat: 41.8456, lng: 44.7218,
        villages: ["მცხეთა","საგურამო","ძეგვი","მუხრანი","წილკანი","ნარეკვავი","ახალქალაქი (მ.)"]
      },
      {
        id: "dusheti", name: "დუშეთი", lat: 42.0862, lng: 44.6967,
        villages: ["დუშეთი","ანანური","ჟინვალი","ბარისახო","ფხოტრა","ოხერი","თეთრიღელე"]
      },
      {
        id: "tianeti", name: "თიანეთი", lat: 42.1100, lng: 45.0093,
        villages: ["თიანეთი","ბოჩორმა","ციხისჯვარი","ახალდაბა (თ.)"]
      },
      {
        id: "stepantsminda", name: "სტეფანწმინდა (ყაზბეგი)", lat: 42.6558, lng: 44.6452,
        villages: ["სტეფანწმინდა","გველეთი","არშა","კობი","ხადა","ფანშეთი"]
      },
      {
        id: "akhalgori", name: "ახალგორი", lat: 42.2167, lng: 44.3667,
        villages: ["ახალგორი","ქსნის ხეობა"]
      }
    ]
  },
  {
    id: "samtskhe_javakheti",
    name: "სამცხე-ჯავახეთი",
    lat: 41.5500, lng: 43.1000,
    municipalities: [
      {
        id: "akhaltsikhe", name: "ახალციხე", lat: 41.6388, lng: 42.9836,
        villages: ["ახალციხე","ვარძია","ხიზაბავრა","ოქროსქედი","ოდისი","ჩხარი (სამ.)"]
      },
      {
        id: "aspindza", name: "ასპინძა", lat: 41.5497, lng: 43.2512,
        villages: ["ასპინძა","ოჩამჩირე","ხიზაბავრა","სათხე"]
      },
      {
        id: "akhalkalaki", name: "ახალქალაქი", lat: 41.4044, lng: 43.4888,
        villages: ["ახალქალაქი","ბოგდანოვკა","ულუსლუ","ქართლი","ხანდო"]
      },
      {
        id: "borjomi", name: "ბორჯომი", lat: 41.8361, lng: 43.4049,
        villages: ["ბორჯომი","ლიქანი","ახალდაბა","წაგვერი","ბახვი (ბ.)","ბეშქენი"]
      },
      {
        id: "adigeni", name: "ადიგენი", lat: 41.6497, lng: 42.7592,
        villages: ["ადიგენი","ტბა","ოტა","ახალსოფელი","საყინულე"]
      },
      {
        id: "ninotsminda_sj", name: "ნინოწმინდა (ს.ჯ.)", lat: 41.2046, lng: 43.5808,
        villages: ["ნინოწმინდა","სულდა","გოგაშენი","ბოგდანოვკა"]
      }
    ]
  },
  {
    id: "guria",
    name: "გურია",
    lat: 41.9239, lng: 42.0021,
    municipalities: [
      {
        id: "ozurgeti", name: "ოზურგეთი", lat: 41.9239, lng: 42.0021,
        villages: ["ოზურგეთი","ბახვი","ნარუჯა","ჭალა (ოზ.)","ჩხარი","ანასეული",
          "ბუკისციხე","ჩოხატაური","ლიხაური","ნაგომარი"]
      },
      {
        id: "lanchkhuti", name: "ლანჩხუთი", lat: 42.0352, lng: 42.2736,
        villages: ["ლანჩხუთი","ლიხაური","ნიგოეთი","ჯუმათი","მელექედური","ბათი"]
      },
      {
        id: "chokhatauri", name: "ჩოხატაური", lat: 41.9853, lng: 42.4017,
        villages: ["ჩოხატაური","ბახვი","ნარუჯა","გეგუთი (ჩ.)"]
      }
    ]
  },
  {
    id: "samegrelo",
    name: "სამეგრელო-ზემო სვანეთი",
    lat: 42.4000, lng: 42.0000,
    municipalities: [
      {
        id: "zugdidi", name: "ზუგდიდი", lat: 42.5069, lng: 41.8714,
        villages: ["ზუგდიდი","ანაკლია","ჩხოროწყუ","ახალ-სენაკი","ნახუნავო","ნოქალაქევი","ხობი"]
      },
      {
        id: "khobi", name: "ხობი", lat: 42.3172, lng: 41.9966,
        villages: ["ხობი","სამიქელია","ნოქალაქევი","ჭკადუაში"]
      },
      {
        id: "senaki", name: "სენაკი", lat: 42.2695, lng: 42.0611,
        villages: ["სენაკი","ნოღა","ობუჯი","ოსიაური","სარგვალი"]
      },
      {
        id: "martvili", name: "მარტვილი", lat: 42.4117, lng: 42.3597,
        villages: ["მარტვილი","ლია","ჩხოროწყუ","ბანძა","ნაოხვამო"]
      },
      {
        id: "chkhorotsqu", name: "ჩხოროწყუ", lat: 42.4827, lng: 42.1960,
        villages: ["ჩხოროწყუ","ლეღვა","ნაწყნავი","ჯვარი"]
      },
      {
        id: "tsalenjikha", name: "წალენჯიხა", lat: 42.6131, lng: 42.2316,
        villages: ["წალენჯიხა","ჯვარი","ნარაზენი","ოდიში"]
      },
      {
        id: "abasha", name: "აბაშა", lat: 42.2133, lng: 42.2115,
        villages: ["აბაშა","ლეკი","ოჩხამური"]
      },
      {
        id: "mestia", name: "მესტია", lat: 43.0503, lng: 42.7289,
        villages: ["მესტია","ლატალი","ლენჯერი","ბეჩო","ფარი","ადიში"]
      },
      {
        id: "lentekhi", name: "ლენტეხი", lat: 42.7736, lng: 42.7339,
        villages: ["ლენტეხი","სვანეთი"]
      }
    ]
  },
  {
    id: "imereti",
    name: "იმერეთი",
    lat: 42.2500, lng: 42.7000,
    municipalities: [
      {
        id: "kutaisi", name: "ქუთაისი", lat: 42.2649, lng: 42.7073,
        villages: ["ქუთაისი","გელათი","მოწამეთა","სარეკი","ციხისუბანი","ნოღა"]
      },
      {
        id: "baghdati", name: "ბაღდათი", lat: 42.0965, lng: 42.8383,
        villages: ["ბაღდათი","ზედა სიმონეთი","ქვედა სიმონეთი","ვაჩნაძიანი"]
      },
      {
        id: "vani", name: "ვანი", lat: 42.1117, lng: 42.5226,
        villages: ["ვანი","ღუმური","შოვლეთი","სალომინაო","ოფიჩხეთი"]
      },
      {
        id: "zestaponi", name: "ზესტაფონი", lat: 42.1104, lng: 43.0462,
        villages: ["ზესტაფონი","ობჩა","მამათი","ქვირილა","ღვანკითი"]
      },
      {
        id: "terjola", name: "თერჯოლა", lat: 42.1329, lng: 43.0898,
        villages: ["თერჯოლა","სვირი","სამელი","ვახანი","ღუმური"]
      },
      {
        id: "samtredia", name: "სამტრედია", lat: 42.1699, lng: 42.3406,
        villages: ["სამტრედია","ყულევი","ძვალი","ნოსირი","ტყვია (სამ.)"]
      },
      {
        id: "sachkhere", name: "საჩხერე", lat: 42.3470, lng: 43.4061,
        villages: ["საჩხერე","ჭალა (საჩხ.)","ჯვარის","ტყვია","ღვანთი","შუა-ტყე"]
      },
      {
        id: "tkibuli", name: "ტყიბული", lat: 42.3569, lng: 42.9812,
        villages: ["ტყიბული","სვერი","ღები","ღვანთი"]
      },
      {
        id: "kharagauli", name: "ხარაგაული", lat: 42.0765, lng: 43.3188,
        villages: ["ხარაგაული","ბექეთი","ნიგოზეთი","ლახუნდარი"]
      },
      {
        id: "khoni", name: "ხონი", lat: 42.3254, lng: 42.5247,
        villages: ["ხონი","მოლითი","ბაია","ჩხარი (ხ.)"]
      },
      {
        id: "tskaltubo", name: "წყალტუბო", lat: 42.3558, lng: 42.5936,
        villages: ["წყალტუბო","ყუმისთავი","ოფიჩხა","გეგუთი","ბოლქვი"]
      }
    ]
  },
  {
    id: "racha",
    name: "რაჭა-ლეჩხუმი და ქვემო სვანეთი",
    lat: 42.5500, lng: 43.2000,
    municipalities: [
      {
        id: "ambrolauri", name: "ამბროლაური", lat: 42.5254, lng: 43.1495,
        villages: ["ამბროლაური","ჩხარი","ღება","სადმელი","ბარი","ჭოჭია"]
      },
      {
        id: "oni", name: "ონი", lat: 42.5826, lng: 43.4421,
        villages: ["ონი","ჭიორა","ბარი","გლოლა","ეწერი"]
      },
      {
        id: "tsageri", name: "ცაგერი", lat: 42.6157, lng: 42.9841,
        villages: ["ცაგერი","ლაილაში","ლასურიაში","ოფიჩხა (ც.)"]
      },
      {
        id: "lentekhi_racha", name: "ლენტეხი (რაჭ.)", lat: 42.7736, lng: 42.7339,
        villages: ["ლენტეხი","სვანეთი","ჩხარი (ლ.)"]
      }
    ]
  },
  {
    id: "adjara",
    name: "აჭარა",
    lat: 41.5500, lng: 42.0000,
    municipalities: [
      {
        id: "batumi", name: "ბათუმი", lat: 41.6168, lng: 41.6367,
        villages: ["ბათუმი","ჩაქვი","ახალი ბათუმი","ნუმბა","ბათუმი-ცენტრი"]
      },
      {
        id: "kobuleti", name: "ქობულეთი", lat: 41.8190, lng: 41.7776,
        villages: ["ქობულეთი","ბობოყვათი","ტეხური","ოჩხამური","ნოღა (ქ.)"]
      },
      {
        id: "khelvachauri", name: "ხელვაჩაური", lat: 41.5542, lng: 41.6628,
        villages: ["ხელვაჩაური","ახალ-შეკვეთილი","შეკვეთილი","სიმონეთი"]
      },
      {
        id: "khulo", name: "ხულო", lat: 41.6404, lng: 42.3137,
        villages: ["ხულო","ჩვანა","ბეშქენი","ხიხაძირი","სხალთა (ხ.)"]
      },
      {
        id: "shuakhevi", name: "შუახევი", lat: 41.5667, lng: 42.3095,
        villages: ["შუახევი","სხალთა","დანდალო","ოდობოო"]
      },
      {
        id: "keda", name: "კედა", lat: 41.4500, lng: 42.1300,
        villages: ["კედა","ჩხუტუნეთი","კინტრიში","ოჩხამური (კ.)"]
      }
    ]
  }
];

// ──────────────────────────────────────────────────────────
// Helper functions
// ──────────────────────────────────────────────────────────

export function getRegionById(id) {
  return REGIONS.find(r => r.id === id) ?? null;
}

export function getMunicipalitiesByRegion(regionId) {
  return getRegionById(regionId)?.municipalities ?? [];
}

export function getMunicipalityById(regionId, munId) {
  return getMunicipalitiesByRegion(regionId).find(m => m.id === munId) ?? null;
}

// ყველა მუნიციპალიტეტის სახელი → [{ name, regionName }]
export function getAllMunicipalityNames() {
  return REGIONS.flatMap(r =>
    r.municipalities.map(m => ({ name: m.name, regionName: r.name }))
  );
}

// ყველა სოფლის სია autocomplete-ისთვის → [{ name, municipalityName, regionName }]
export function getAllVillages() {
  return REGIONS.flatMap(r =>
    r.municipalities.flatMap(m =>
      m.villages.map(v => ({ name: v, municipalityName: m.name, regionName: r.name }))
    )
  );
}

// Haversine: ორ წერტილს შორის მანძილი კმ-ში
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// კოორდინატებით უახლოეს მუნიციპალიტეტს პოულობს
export function findNearestLocation(lat, lng) {
  let best = null;
  let bestDist = Infinity;
  for (const region of REGIONS) {
    for (const m of region.municipalities) {
      const d = haversine(lat, lng, m.lat, m.lng);
      if (d < bestDist) {
        bestDist = d;
        best = { region, municipality: m, distanceKm: Math.round(d) };
      }
    }
  }
  return best;
}

// მასწავლებლის city ველი ემთხვევა რეგიონს?
export function cityInRegion(city, regionId) {
  const region = getRegionById(regionId);
  if (!region) return false;
  const names = region.municipalities.map(m => m.name.toLowerCase());
  return names.some(n => city?.toLowerCase().includes(n) || n.includes(city?.toLowerCase() ?? ""));
}

// მასწავლებლის city ველი ემთხვევა მუნიციპალიტეტს?
export function cityInMunicipality(city, munName) {
  if (!city || !munName) return false;
  const c = city.toLowerCase();
  const m = munName.toLowerCase().replace(/\s*\(.*?\)/, "").trim();
  return c.includes(m) || m.includes(c);
}

// მასწავლებლის კოორდინატები — municipality → region → null
export function getTutorCoords(tutor) {
  if (!tutor) return null;
  // municipality_id-ით
  if (tutor.region_id && tutor.municipality_id) {
    const mun = getMunicipalityById(tutor.region_id, tutor.municipality_id);
    if (mun?.lat && mun?.lng) return { lat: mun.lat, lng: mun.lng };
  }
  // region_id-ით
  if (tutor.region_id) {
    const region = getRegionById(tutor.region_id);
    if (region?.lat && region?.lng) return { lat: region.lat, lng: region.lng };
  }
  // city სახელით
  if (tutor.city) {
    const cityLower = tutor.city.toLowerCase();
    for (const region of REGIONS) {
      for (const m of region.municipalities) {
        if (m.name.toLowerCase().includes(cityLower) || cityLower.includes(m.name.toLowerCase())) {
          return { lat: m.lat, lng: m.lng };
        }
      }
    }
  }
  return null;
}
