final emergencyCardValueTranslations = <String, List<String>>{
  'en': [
    'I have diabetes. If I lose consciousness, call 112. Do not give insulin without checking blood glucose.',
    'Insulin + tablets'
  ],
  'de': [
    'Ich habe Diabetes. Rufen Sie bei Bewusstlosigkeit 112. Kein Insulin ohne Blutzuckerkontrolle geben.',
    'Insulin + Tabletten'
  ],
  'fr': [
    "Je suis diabétique. En cas de perte de connaissance, appelez le 112. Ne donnez pas d’insuline sans contrôler la glycémie.",
    'Insuline + comprimés'
  ],
  'es': [
    'Tengo diabetes. Si pierdo el conocimiento, llame al 112. No administre insulina sin comprobar la glucosa.',
    'Insulina + comprimidos'
  ],
  'it': [
    'Ho il diabete. In caso di perdita di coscienza, chiamare il 112. Non somministrare insulina senza controllare la glicemia.',
    'Insulina + compresse'
  ],
  'pl': [
    'Mam cukrzycę. W razie utraty przytomności zadzwoń pod 112. Nie podawaj insuliny bez sprawdzenia glukozy.',
    'Insulina + tabletki'
  ],
  'uk': [
    'У мене діабет. У разі втрати свідомості викличте 112. Не вводьте інсулін без перевірки глюкози.',
    'Інсулін + таблетки'
  ],
  'ru': [
    'У меня диабет. При потере сознания вызвать 112. Не давать инсулин без проверки сахара.',
    'Инсулин + таблетки'
  ],
  'pt': [
    'Tenho diabetes. Em caso de perda de consciência, ligue 112. Não administre insulina sem verificar a glicose.',
    'Insulina + comprimidos'
  ],
  'nl': [
    'Ik heb diabetes. Bel 112 bij bewusteloosheid. Geef geen insuline zonder de bloedglucose te controleren.',
    'Insuline + tabletten'
  ],
  'ro': [
    'Am diabet. În caz de pierdere a cunoștinței, sunați la 112. Nu administrați insulină fără verificarea glicemiei.',
    'Insulină + comprimate'
  ],
  'cs': [
    'Mám cukrovku. Při ztrátě vědomí volejte 112. Nepodávejte inzulín bez kontroly glykémie.',
    'Inzulín + tablety'
  ],
  'sk': [
    'Mám cukrovku. Pri strate vedomia volajte 112. Nepodávajte inzulín bez kontroly glykémie.',
    'Inzulín + tablety'
  ],
  'hu': [
    'Cukorbeteg vagyok. Eszméletvesztés esetén hívja a 112-t. Vércukormérés nélkül ne adjon inzulint.',
    'Inzulin + tabletták'
  ],
  'sv': [
    'Jag har diabetes. Ring 112 vid medvetslöshet. Ge inte insulin utan att kontrollera blodsockret.',
    'Insulin + tabletter'
  ],
  'da': [
    'Jeg har diabetes. Ring 112 ved bevidstløshed. Giv ikke insulin uden at kontrollere blodsukkeret.',
    'Insulin + tabletter'
  ],
  'fi': [
    'Minulla on diabetes. Soita tajuttomuustilanteessa 112. Älä anna insuliinia tarkistamatta verensokeria.',
    'Insuliini + tabletit'
  ],
  'no': [
    'Jeg har diabetes. Ring 112 ved bevisstløshet. Ikke gi insulin uten å kontrollere blodsukkeret.',
    'Insulin + tabletter'
  ],
  'el': [
    'Έχω διαβήτη. Σε περίπτωση απώλειας συνείδησης καλέστε το 112. Μη χορηγείτε ινσουλίνη χωρίς έλεγχο γλυκόζης.',
    'Ινσουλίνη + δισκία'
  ],
  'tr': [
    'Diyabetim var. Bilinç kaybında 112’yi arayın. Kan şekerini kontrol etmeden insülin vermeyin.',
    'İnsülin + tabletler'
  ],
  'bg': [
    'Имам диабет. При загуба на съзнание се обадете на 112. Не давайте инсулин без проверка на кръвната захар.',
    'Инсулин + таблетки'
  ],
  'hr': [
    'Imam dijabetes. U slučaju gubitka svijesti nazovite 112. Ne dajte inzulin bez provjere glukoze.',
    'Inzulin + tablete'
  ],
  'sl': [
    'Imam sladkorno bolezen. Ob izgubi zavesti pokličite 112. Ne dajajte inzulina brez preverjanja glukoze.',
    'Inzulin + tablete'
  ],
  'lt': [
    'Sergu diabetu. Praradus sąmonę skambinkite 112. Neduokite insulino nepatikrinę gliukozės.',
    'Insulinas + tabletės'
  ],
  'lv': [
    'Man ir diabēts. Samaņas zuduma gadījumā zvaniet 112. Nedodiet insulīnu, nepārbaudot glikozes līmeni.',
    'Insulīns + tabletes'
  ],
  'et': [
    'Mul on diabeet. Teadvusekaotuse korral helistage 112. Ärge andke insuliini ilma veresuhkrut kontrollimata.',
    'Insuliin + tabletid'
  ],
  'sr': [
    'Имам дијабетес. У случају губитка свести позовите 112. Не дајте инсулин без провере глукозе.',
    'Инсулин + таблете'
  ],
  'sq': [
    'Kam diabet. Në rast humbjeje të vetëdijes telefononi 112. Mos jepni insulinë pa kontrolluar glukozën.',
    'Insulinë + tableta'
  ],
  'mk': [
    'Имам дијабетес. При губење на свеста јавете се на 112. Не давајте инсулин без проверка на гликозата.',
    'Инсулин + таблети'
  ],
  'is': [
    'Ég er með sykursýki. Hringið í 112 við meðvitundarleysi. Ekki gefa insúlín án þess að mæla blóðsykur.',
    'Insúlín + töflur'
  ],
};

String emergencyInstructionText(String languageCode) =>
    (emergencyCardValueTranslations[languageCode] ??
        emergencyCardValueTranslations['en']!)[0];

String insulinAndTabletsText(String languageCode) =>
    (emergencyCardValueTranslations[languageCode] ??
        emergencyCardValueTranslations['en']!)[1];

const defaultEmergencyInstructionSource =
    'У меня диабет. При потере сознания вызвать 112. '
    'Не давать инсулин без проверки сахара.';

bool isDefaultEmergencyInstruction(String value) =>
    value.trim().isEmpty ||
    value.trim() == defaultEmergencyInstructionSource ||
    emergencyCardValueTranslations.values
        .any((translations) => translations[0] == value.trim());

bool isInsulinAndTabletsValue(String value) {
  final normalized = value.trim().toLowerCase();
  return normalized == 'инсулин + таблетки' ||
      normalized == 'инсулин+таблетки';
}
