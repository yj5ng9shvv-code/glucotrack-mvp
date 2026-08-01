import fs from "node:fs";

const file = "lib/l10n/family_access_translations.dart";
const translations = {
  de: ["Für den Familienzugriff ist ein Family-Tarif erforderlich.", "Limit für Familienmitglieder erreicht.", "Ungültiger Einladungscode."],
  fr: ["Le forfait Family est requis pour l’accès familial.", "Limite de membres de la famille atteinte.", "Code d’invitation invalide."],
  es: ["Se requiere el plan Family para el acceso familiar.", "Se alcanzó el límite de miembros familiares.", "Código de invitación no válido."],
  it: ["Per l’accesso familiare è richiesto il piano Family.", "Limite dei membri familiari raggiunto.", "Codice di invito non valido."],
  pl: ["Dostęp rodzinny wymaga planu Family.", "Osiągnięto limit członków rodziny.", "Nieprawidłowy kod zaproszenia."],
  uk: ["Для сімейного доступу потрібен тариф Family.", "Досягнуто ліміт членів сім’ї.", "Недійсний код запрошення."],
  ru: ["Для семейного доступа нужен тариф Family.", "Достигнут лимит участников семьи.", "Неверный код приглашения."],
  pt: ["O plano Family é necessário para o acesso familiar.", "Limite de membros da família atingido.", "Código de convite inválido."],
  nl: ["Voor gezinstoegang is het Family-abonnement vereist.", "Limiet voor gezinsleden bereikt.", "Ongeldige uitnodigingscode."],
  ro: ["Planul Family este necesar pentru accesul familiei.", "Limita membrilor familiei a fost atinsă.", "Cod de invitație nevalid."],
  cs: ["Pro rodinný přístup je vyžadován tarif Family.", "Byl dosažen limit členů rodiny.", "Neplatný kód pozvánky."],
  sk: ["Na rodinný prístup je potrebný plán Family.", "Bol dosiahnutý limit členov rodiny.", "Neplatný kód pozvánky."],
  hu: ["A családi hozzáféréshez Family csomag szükséges.", "Elérte a családtagok számának korlátját.", "Érvénytelen meghívókód."],
  sv: ["Family-plan krävs för familjeåtkomst.", "Gränsen för familjemedlemmar har nåtts.", "Ogiltig inbjudningskod."],
  da: ["Family-plan kræves for familieadgang.", "Grænsen for familiemedlemmer er nået.", "Ugyldig invitationskode."],
  fi: ["Perhekäyttö edellyttää Family-tilausta.", "Perheenjäsenten raja on saavutettu.", "Virheellinen kutsukoodi."],
  no: ["Family-abonnement kreves for familietilgang.", "Grensen for familiemedlemmer er nådd.", "Ugyldig invitasjonskode."],
  el: ["Απαιτείται πρόγραμμα Family για οικογενειακή πρόσβαση.", "Έχει συμπληρωθεί το όριο μελών οικογένειας.", "Μη έγκυρος κωδικός πρόσκλησης."],
  tr: ["Aile erişimi için Family planı gereklidir.", "Aile üyesi sınırına ulaşıldı.", "Geçersiz davet kodu."],
  bg: ["За семеен достъп е необходим план Family.", "Достигнат е лимитът за членове на семейството.", "Невалиден код за покана."],
  hr: ["Za obiteljski pristup potreban je Family paket.", "Dosegnuto je ograničenje članova obitelji.", "Nevažeći pozivni kod."],
  sl: ["Za družinski dostop je potreben paket Family.", "Dosežena je omejitev družinskih članov.", "Neveljavna koda povabila."],
  lt: ["Šeimos prieigai reikalingas Family planas.", "Pasiektas šeimos narių limitas.", "Neteisingas kvietimo kodas."],
  lv: ["Ģimenes piekļuvei nepieciešams Family plāns.", "Sasniegts ģimenes locekļu limits.", "Nederīgs uzaicinājuma kods."],
  et: ["Pere juurdepääsuks on vaja Family paketti.", "Pereliikmete limiit on täis.", "Vigane kutsekood."],
  sr: ["За породични приступ потребан је Family пакет.", "Достигнут је лимит чланова породице.", "Неважећи код позивнице."],
  sq: ["Për akses familjar kërkohet plani Family.", "U arrit kufiri i anëtarëve të familjes.", "Kod ftese i pavlefshëm."],
  mk: ["За семеен пристап е потребен Family пакет.", "Достигнат е лимитот на членови на семејството.", "Невалиден код за покана."],
  is: ["Family áskrift þarf fyrir fjölskylduaðgang.", "Hámarki fjölskyldumeðlima hefur verið náð.", "Ógildur boðskóði."],
};

let text = fs.readFileSync(file, "utf8");
for (const [locale, values] of Object.entries(translations)) {
  const [required, limit, invalid] = values;
  const block = new RegExp(`(  '${locale}': \\{[\\s\\S]*?)(?=\\n  '[^']+': \\{|\\n\\};)`, "m");
  text = text.replace(block, (match) => match
    .replace(/'family\.error\.familySubscriptionRequired':\s*'Family plan is required for family access\.'/g, `'family.error.familySubscriptionRequired':\n        '${required}'`)
    .replace(/'family\.error\.familySubscriptionRequired':\s*\n\s*'Family plan is required for family access\.'/g, `'family.error.familySubscriptionRequired':\n        '${required}'`)
    .replace(/'family\.error\.memberLimitReached': 'Family member limit reached\.'/g, `'family.error.memberLimitReached': '${limit}'`)
    .replace(/'family\.error\.invalidInvitationCode': 'Invalid invitation code\.'/g, `'family.error.invalidInvitationCode': '${invalid}'`));
}
fs.writeFileSync(file, text, "utf8");
