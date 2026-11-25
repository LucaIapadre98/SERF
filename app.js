const continents = [
  { name: "Africa", nameIt: "Africa", color: "#fb8e76", icon: "✦", description: "Un mosaico di culture, lingue e paesaggi: dalle foreste tropicali ai grandi deserti." },
  { name: "Asia", nameIt: "Asia", color: "#f4c767", icon: "✧", description: "Il continente più esteso ospita paesaggi straordinari e oltre metà della popolazione mondiale." },
  { name: "Europe", nameIt: "Europa", color: "#9f91ff", icon: "✺", description: "Una regione ricca di culture, plasmata da secoli di scambi e incontri." },
  { name: "North America", nameIt: "America del Nord", color: "#59d6cb", icon: "✧", description: "Dalle coste artiche alle regioni tropicali, una grande varietà di ambienti e paesaggi." },
  { name: "South America", nameIt: "America del Sud", color: "#72dfaa", icon: "✦", description: "Le Ande, l'Amazzonia e una straordinaria varietà di ecosistemi." },
  { name: "Oceania", nameIt: "Oceania", color: "#67b9ff", icon: "✧", description: "Un insieme di isole, barriere coralline e habitat unici nell'oceano Pacifico." },
  { name: "Antarctica", nameIt: "Antartide", color: "#bed4ee", icon: "❄", description: "Un continente remoto e coperto di ghiacci, senza popolazione permanente." },
];

const colors = new Map(continents.map((continent) => [continent.name, continent.color]));
const continentNames = new Map(continents.map((continent) => [continent.name, continent.nameIt]));
const localizedCountryNames = new Intl.DisplayNames(["it"], { type: "region" });
const otherColor = "#8b91ad";
const width = 720;
const height = 640;
const center = [width / 2, height / 2];
const initialScale = 248;
const features = window.worldFeatures;
const globeSvg = d3.select("#globeSvg");
const globeLayer = globeSvg.select("#globeLayer");
const projection = d3.geoOrthographic()
  .clipAngle(90)
  .scale(initialScale)
  .translate(center)
  .precision(0.35)
  .rotate([-18, -12, 0]);
const geoPath = d3.geoPath(projection);

let selectedFeature = null;
let selectedContinent = null;
let isSpinning = false;
let animationFrame = 0;
let dragMoved = false;
let ignoreClickUntil = 0;
let historyRequestId = 0;
let historyController = null;

const sphere = { type: "Sphere" };
globeLayer.append("path").datum(sphere).attr("class", "sphere").attr("d", geoPath);
globeLayer.append("path").datum(d3.geoGraticule10()).attr("class", "graticule").attr("d", geoPath);

const countryPaths = globeLayer.selectAll(".country-path")
  .data(features)
  .join("path")
  .attr("class", "country-path")
  .attr("d", geoPath)
  .attr("fill", (feature) => colors.get(feature.properties.continent) || otherColor)
  .attr("tabindex", 0)
  .attr("role", "button")
  .attr("aria-label", (feature) => `${getCountryName(feature.properties)}, ${getContinentName(feature.properties.continent)}`)
  .on("click", (event, feature) => {
    event.stopPropagation();
    if (Date.now() < ignoreClickUntil) return;
    selectCountry(feature);
  })
  .on("keydown", (event, feature) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectCountry(feature);
    }
  })
  .on("pointerenter", function () {
    d3.select(this).raise();
  });

globeLayer.append("path")
  .datum(sphere)
  .attr("class", "sphere-shade")
  .attr("d", geoPath);

function sumPopulation(places) {
  return places.reduce((total, feature) => total + Number(feature.properties.population || 0), 0);
}

function sumGdp(places) {
  return places.reduce((total, feature) => total + Number(feature.properties.gdp || 0), 0);
}

function formatPopulation(value) {
  if (!value) return "N/D";
  if (value >= 1e9) return `${(value / 1e9).toLocaleString("it-IT", { maximumFractionDigits: 1 })} mld`;
  if (value >= 1e6) return `${(value / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 1 })} mln`;
  return new Intl.NumberFormat("it-IT").format(value);
}

function formatGdp(value) {
  if (!value) return "N/D";
  const dollars = value * 1e6;
  if (dollars >= 1e12) return `${(dollars / 1e12).toLocaleString("it-IT", { maximumFractionDigits: 1 })} mila mld USD`;
  if (dollars >= 1e9) return `${(dollars / 1e9).toLocaleString("it-IT", { maximumFractionDigits: 1 })} mld USD`;
  return `${(dollars / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 1 })} mln USD`;
}

function getCountryName(properties) {
  if (properties.nameIt && properties.nameIt !== properties.name) return properties.nameIt;
  if (/^[A-Z]{2}$/.test(properties.iso2) && properties.iso2 !== "AQ") {
    return localizedCountryNames.of(properties.iso2);
  }
  return properties.nameIt || properties.name;
}

function getContinentName(name) {
  return continentNames.get(name) || "Oceano aperto";
}

function translateIncome(value) {
  const cleaned = value.replace(/^\d+\.\s*/, "");
  const translations = {
    "Low income": "Basso reddito",
    "Lower middle income": "Reddito medio-basso",
    "Upper middle income": "Reddito medio-alto",
    "High income: nonOECD": "Alto reddito (non OCSE)",
    "High income: OECD": "Alto reddito (OCSE)",
  };
  return translations[cleaned] || cleaned || "N/D";
}

function translateEconomy(value) {
  const cleaned = value.replace(/^\d+\.\s*/, "");
  const translations = {
    "Developed region: G7": "Economia avanzata · G7",
    "Developed region: nonG7": "Economia avanzata",
    "Emerging region: BRIC": "Economia emergente · BRICS",
    "Emerging region: MIKT": "Economia emergente · MIKTA",
    "Emerging region: G20": "Economia emergente · G20",
    "Developing region": "Economia in via di sviluppo",
    "Least developed region": "Paese meno sviluppato",
  };
  return translations[cleaned] || cleaned || "N/D";
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createFact(label, value) {
  const card = makeElement("div", "fact-card");
  card.append(makeElement("span", "fact-label", label));
  const valueElement = makeElement("strong", "fact-value", value);
  if (value.length > 18) valueElement.classList.add("small");
  card.append(valueElement);
  return card;
}

function showProfile({ kind, title, subtitle, color, icon, facts, note, includeHistory = false }) {
  const root = makeElement("div", "detail-content");
  root.style.setProperty("--detail-color", color);

  const type = makeElement("div", "detail-type");
  type.append(makeElement("i", "", ""));
  type.append(document.createTextNode(kind));

  const heading = makeElement("h3", "detail-title", title);
  const subheading = makeElement("p", "detail-subtitle", subtitle);
  const rule = makeElement("div", "detail-rule");
  const grid = makeElement("div", "facts-grid");
  let historyCard = null;
  facts.forEach(([label, value]) => grid.append(createFact(label, value)));
  if (includeHistory) {
    historyCard = makeElement("section", "history-card");
    const historyHeading = makeElement("div", "history-heading");
    historyHeading.append(makeElement("span", "history-symbol", "↺"));
    historyHeading.append(makeElement("h4", "", "BREVE STORIA"));
    const historyText = makeElement("p", "history-text", "Caricamento della storia in italiano…");
    historyText.id = "historyText";
    historyText.setAttribute("aria-live", "polite");
    const historySource = makeElement("a", "history-source", "Fonte: Wikipedia in italiano · CC BY-SA 4.0");
    historySource.id = "historySource";
    historySource.hidden = true;
    historySource.target = "_blank";
    historySource.rel = "noreferrer";
    const historyLicense = makeElement("a", "history-source", "Licenza CC BY-SA 4.0");
    historyLicense.id = "historyLicense";
    historyLicense.href = "https://creativecommons.org/licenses/by-sa/4.0/";
    historyLicense.hidden = true;
    historyLicense.target = "_blank";
    historyLicense.rel = "noreferrer";
    const retry = makeElement("button", "history-retry", "Riprova");
    retry.id = "historyRetry";
    retry.hidden = true;
    historyCard.append(historyHeading, historyText, historySource, historyLicense, retry);
  }
  const noteElement = makeElement("p", "detail-note", note);

  if (icon) {
    const iconElement = makeElement("span", "detail-icon", icon);
    root.append(iconElement);
  }
  root.append(type, heading, subheading, rule, grid);
  if (historyCard) root.append(historyCard);
  root.append(noteElement);
  document.querySelector("#placeDetail").replaceChildren(root);
}

function updateSelectionStyles() {
  countryPaths
    .classed("is-dimmed", (feature) => Boolean(selectedContinent) && feature.properties.continent !== selectedContinent)
    .classed("is-selected", (feature) => feature === selectedFeature)
    .attr("aria-pressed", (feature) => String(feature === selectedFeature));

  document.querySelectorAll(".continent-chip").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.continent === selectedContinent));
  });
}

function selectCountry(feature) {
  cancelHistoryRequest();
  selectedFeature = feature;
  selectedContinent = null;
  updateSelectionStyles();

  const details = feature.properties;
  const continent = continents.find((item) => item.name === details.continent);
  const color = colors.get(details.continent) || otherColor;
  const income = translateIncome(details.income);
  const economy = translateEconomy(details.economy);

  showProfile({
    kind: "SCHEDA DEL PAESE",
    title: getCountryName(details),
    subtitle: `${getContinentName(details.continent)} · Dati di riferimento`,
    color,
    icon: continent ? continent.icon : "✦",
    facts: [
      ["POPOLAZIONE", formatPopulation(Number(details.population))],
      ["PIL", formatGdp(Number(details.gdp))],
      ["FASCIA DI REDDITO", income],
      ["PROFILO ECONOMICO", economy],
    ],
    note: "Stime demografiche ed economiche: dati Natural Earth, circa 2019.",
    includeHistory: true,
  });
  loadCountryHistory(details);
}

function cancelHistoryRequest() {
  historyRequestId += 1;
  historyController?.abort();
  historyController = null;
}

async function requestWikipedia(parameters, signal) {
  const url = new URL("https://it.wikipedia.org/w/api.php");
  Object.entries({ ...parameters, format: "json", origin: "*" })
    .forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Wikipedia ha risposto con stato ${response.status}.`);
  const result = await response.json();
  if (result.error) throw new Error(result.error.info || "Wikipedia non ha restituito i dati richiesti.");
  return result;
}

function shortenHistory(text, maximumLength = 560) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximumLength) return normalized;
  const end = normalized.lastIndexOf(". ", maximumLength);
  return end > maximumLength * 0.6
    ? normalized.slice(0, end + 1)
    : `${normalized.slice(0, maximumLength).trimEnd()}…`;
}

function selectFormationParagraphs(paragraphs) {
  const formationPattern = /processo di unificazione|unificazione (?:dell|del|della)|dichiarazione (?:dell|di|della) indipendenza|indipendenza.{0,80}(?:proclam|otten|conquist|raggiunt)|nascita della repubblica|proclam(?:azione|ò).{0,80}(?:repubblica|regno|stato)|fondazione.{0,80}(?:repubblica|stato)|costituzione della repubblica|riunificazione della germania|decolonizzazione/i;
  const formationParagraphs = paragraphs.filter((paragraph) =>
    formationPattern.test(paragraph) && /\b(?:17|18|19|20)\d{2}\b/.test(paragraph));
  if (!formationParagraphs.length) return paragraphs.slice(0, 2);
  const first = formationParagraphs[0];
  const last = formationParagraphs[formationParagraphs.length - 1];
  return first === last ? [first] : [first, last];
}

async function loadCountryHistory(properties) {
  historyController?.abort();
  const controller = new AbortController();
  historyController = controller;
  const requestId = ++historyRequestId;
  const title = getCountryName(properties);
  const historyText = document.querySelector("#historyText");
  const historySource = document.querySelector("#historySource");
  const historyLicense = document.querySelector("#historyLicense");
  const retry = document.querySelector("#historyRetry");
  if (!historyText || !historySource || !historyLicense || !retry) return;

  historyText.textContent = "Caricamento della storia in italiano…";
  retry.hidden = true;
  historySource.hidden = true;
  historyLicense.hidden = true;
  retry.onclick = () => loadCountryHistory(properties);

  try {
    const sectionsResult = await requestWikipedia({ action: "parse", page: title, prop: "sections" }, controller.signal);
    const sections = sectionsResult.parse?.sections || [];
    const historySection = sections.find((section) =>
      /^(storia|origini|formazione|fondazione|indipendenza)\b/i.test(section.line.trim()));
    if (!historySection) throw new Error("La voce italiana non contiene una sezione storica dedicata.");

    const article = await requestWikipedia({
      action: "parse",
      page: title,
      section: historySection.index,
      prop: "text",
    }, controller.signal);
    const html = article.parse?.text?.["*"];
    if (!html) throw new Error("La sezione storica non è disponibile.");

    const documentFragment = new DOMParser().parseFromString(html, "text/html");
    documentFragment.querySelectorAll("sup, .mw-editsection, table, .navbox, .reference").forEach((element) => element.remove());
    const paragraphs = [...documentFragment.querySelectorAll("p")]
      .map((paragraph) => paragraph.textContent.trim())
      .filter((paragraph) => paragraph.length > 45);
    if (!paragraphs.length) throw new Error("La sezione storica non contiene un testo consultabile.");
    if (requestId !== historyRequestId) return;

    const articleTitle = article.parse.title || title;
    const articleUrl = `https://it.wikipedia.org/wiki/${encodeURIComponent(articleTitle.replace(/ /g, "_"))}`;
    historyText.textContent = shortenHistory(selectFormationParagraphs(paragraphs).join(" "), 680);
    historySource.href = articleUrl;
    historySource.textContent = `Voce Wikipedia: ${articleTitle}`;
    historySource.hidden = false;
    historyLicense.hidden = false;
  } catch (error) {
    if (error.name === "AbortError" || requestId !== historyRequestId) return;
    console.error(`Impossibile caricare la storia di ${title}.`, error);
    historyText.textContent = error.message.includes("non contiene una sezione storica")
      ? "La voce italiana non contiene una sezione storica dedicata."
      : "La storia non è disponibile al momento. Controlla la connessione e riprova.";
    retry.hidden = false;
  }
}

function selectContinent(name) {
  const continent = continents.find((item) => item.name === name);
  if (!continent) return;
  cancelHistoryRequest();
  selectedFeature = null;
  selectedContinent = name;
  updateSelectionStyles();

  const places = features.filter((feature) => feature.properties.continent === name);
  const population = sumPopulation(places);
  const gdp = sumGdp(places);
  const count = places.filter((feature) => feature.properties.name !== "Antarctica").length;
  const populationValue = name === "Antarctica" ? "Nessuna popolazione permanente" : formatPopulation(population);
  const facts = [
    ["PAESI E TERRITORI", new Intl.NumberFormat("it-IT").format(count)],
    ["POPOLAZIONE", populationValue],
    ["PIL COMPLESSIVO", name === "Antarctica" ? "N/D" : formatGdp(gdp)],
    ["CONTINENTE", continent.nameIt],
  ];

  showProfile({
    kind: "SCHEDA DEL CONTINENTE",
    title: continent.nameIt,
    subtitle: "Uno sguardo più da vicino a questa parte del mondo",
    color: continent.color,
    icon: continent.icon,
    facts,
    note: `${continent.description} Dati di riferimento, circa 2019.`,
  });
}

function showWorldOverview() {
  cancelHistoryRequest();
  selectedFeature = null;
  selectedContinent = null;
  updateSelectionStyles();
  const landPlaces = features.filter((feature) => feature.properties.continent !== "Seven seas (open ocean)");
  showProfile({
    kind: "PANORAMICA DEL PIANETA",
    title: "Il mondo ti aspetta",
    subtitle: "Paesi e territori da scoprire in ogni angolo del pianeta",
    color: "#a397ff",
    icon: "🌎",
    facts: [
      ["CONTINENTI", String(continents.length)],
      ["POPOLAZIONE", formatPopulation(sumPopulation(landPlaces))],
      ["PAESI E TERRITORI", String(landPlaces.length)],
      ["SUPERFICIE", "Terre e oceani"],
    ],
    note: "Scegli un continente o seleziona un Paese sul mappamondo per scoprirne il profilo.",
  });
}

document.querySelectorAll(".continent-chip").forEach((button) => {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => selectContinent(button.dataset.continent));
});

function redrawGlobe() {
  globeLayer.selectAll("path").attr("d", geoPath);
}

globeSvg.call(d3.drag()
  .on("start", () => {
    dragMoved = false;
    globeSvg.classed("is-dragging", true);
  })
  .on("drag", (event) => {
    if (Math.abs(event.dx) + Math.abs(event.dy) > 0) dragMoved = true;
    const rotation = projection.rotate();
    const degreesPerPixel = 180 / (Math.PI * projection.scale());
    projection.rotate([
      rotation[0] + event.dx * degreesPerPixel,
      Math.max(-85, Math.min(85, rotation[1] - event.dy * degreesPerPixel)),
      rotation[2],
    ]);
    redrawGlobe();
  })
  .on("end", () => {
    globeSvg.classed("is-dragging", false);
    if (dragMoved) ignoreClickUntil = Date.now() + 180;
  }));

document.querySelector("#zoomIn").addEventListener("click", () => {
  projection.scale(Math.min(310, projection.scale() + 18));
  redrawGlobe();
});

document.querySelector("#zoomOut").addEventListener("click", () => {
  projection.scale(Math.max(190, projection.scale() - 18));
  redrawGlobe();
});

document.querySelector("#resetGlobe").addEventListener("click", () => {
  projection.scale(initialScale).rotate([-18, -12, 0]);
  stopRotation();
  redrawGlobe();
});

document.querySelector("#globeSvg").addEventListener("wheel", (event) => {
  event.preventDefault();
  const delta = event.deltaY < 0 ? 12 : -12;
  projection.scale(Math.max(190, Math.min(310, projection.scale() + delta)));
  redrawGlobe();
}, { passive: false });

function spinFrame() {
  if (!isSpinning) return;
  const rotation = projection.rotate();
  projection.rotate([rotation[0] + 0.12, rotation[1], rotation[2]]);
  redrawGlobe();
  animationFrame = requestAnimationFrame(spinFrame);
}

function stopRotation() {
  isSpinning = false;
  cancelAnimationFrame(animationFrame);
  document.querySelector("#rotateButton").setAttribute("aria-pressed", "false");
  document.querySelector("#rotateLabel").textContent = "Auto";
}

document.querySelector("#rotateButton").addEventListener("click", (event) => {
  isSpinning = !isSpinning;
  event.currentTarget.setAttribute("aria-pressed", String(isSpinning));
  document.querySelector("#rotateLabel").textContent = isSpinning ? "Pausa" : "Auto";
  if (isSpinning) animationFrame = requestAnimationFrame(spinFrame);
});

document.querySelector("#globalPopulation").textContent =
  `${(sumPopulation(features.filter((feature) => feature.properties.continent !== "Seven seas (open ocean)")) / 1e9).toLocaleString("it-IT", { maximumFractionDigits: 1 })} mld`;
showWorldOverview();
