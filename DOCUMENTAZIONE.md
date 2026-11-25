# Atlante del mondo
## Descrizione

Atlante del mondo è una piccola applicazione web interattiva, realizzata in italiano, per esplorare il globo e consultare informazioni di base su Paesi, territori e continenti. La pagina combina un mappamondo colorato con schede informative e una breve storia dei Paesi selezionati.

L’applicazione è composta da file statici: non richiede un server applicativo, un database, un processo di compilazione o pacchetti da installare. Un server HTTP statico è sufficiente per eseguirla.

## Funzionalità

### Mappamondo

- Mostra il globo con oceani, griglia geografica, confini e colori distinti per continente.
- Permette di ruotare il globo trascinandolo con il mouse o con un gesto touch.
- Offre la rotazione automatica, controllabile con il pulsante **Auto/Pausa**.
- Permette di ingrandire o ridurre la vista con i pulsanti dedicati o con la rotella del mouse.
- Include un controllo per ripristinare orientamento e zoom iniziali.
- Evidenzia il Paese selezionato e attenua visivamente gli altri Paesi quando si seleziona un continente.

La rappresentazione è una proiezione ortografica disegnata in SVG: simula la vista di un globo tridimensionale, ma non è una scena 3D basata su WebGL.

### Schede dei Paesi

Selezionando un Paese o un territorio sul globo si apre una scheda con:

- nome e continente;
- popolazione;
- PIL;
- fascia di reddito;
- profilo economico;
- una breve storia della formazione, quando disponibile nella voce italiana di Wikipedia.

I dati demografici ed economici integrati sono indicativi e riferiti a circa il 2019. I valori possono essere assenti o non aggiornati; la scheda riporta una nota sulla data di riferimento.

### Schede dei continenti

I pulsanti permettono di selezionare Africa, Asia, Europa, America del Nord, America del Sud, Oceania e Antartide. La scheda del continente mostra il numero di Paesi e territori, la popolazione e il PIL complessivo calcolati dai dati disponibili, oltre a una breve descrizione. Per l’Antartide l’app indica che non ha popolazione permanente e non mostra un PIL.

### Interfaccia e accessibilità

- Interfaccia e informazioni dell’app sono in italiano; nomi dei Paesi e numeri usano le funzionalità di localizzazione del browser.
- La pagina si adatta a schermi desktop e mobili.
- Paesi e controlli sono utilizzabili da tastiera; le schede aggiornate comunicano il contenuto tramite regioni live accessibili.
- I pulsanti hanno etichette accessibili e gli elementi interattivi mostrano indicatori di focus.
- Le animazioni rispettano l’impostazione di sistema per la riduzione del movimento.

## Come è implementata

### Struttura dei file

| File | Responsabilità |
| --- | --- |
| `index.html` | Struttura della pagina, navigazione, controlli, area SVG del globo e collegamento agli script e agli stili. |
| `styles.css` | Aspetto grafico, colori, layout responsive, stati di selezione e animazioni. |
| `app.js` | Rendering geografico, interazioni, schede, formattazione dei dati e caricamento della storia. |
| `assets/world-countries.js` | Dataset locale con 242 geometrie geografiche e proprietà di Paesi e territori. |
| `assets/d3.min.js` | Distribuzione locale di D3.js 7.9.0, usata per la proiezione e le interazioni geografiche. |
| `assets/D3-LICENSE.txt` | Testo della licenza di D3.js. |

### Disegno del globo

Il dataset locale espone le geometrie come `window.worldFeatures`. Ogni elemento è una feature geografica con geometria `Polygon` o `MultiPolygon` e proprietà come nome, codice, continente, popolazione, PIL, fascia di reddito e profilo economico.

`app.js` usa D3.js per:

1. creare una proiezione `geoOrthographic`, che mostra una faccia del globo e ritaglia quella opposta;
2. convertire le geometrie geografiche in percorsi SVG;
3. disegnare la sfera, la griglia geografica e i confini nazionali;
4. assegnare ai Paesi il colore associato al continente.

Durante il trascinamento la rotazione della proiezione viene aggiornata e i percorsi SVG sono ridisegnati. Lo zoom modifica la scala della proiezione entro limiti prestabiliti. La rotazione automatica aggiorna gradualmente l’orientamento con `requestAnimationFrame`.

### Selezione e schede informative

La selezione di un Paese o di un continente aggiorna lo stato dell’interfaccia, gli stili del globo e il contenuto del pannello laterale. Le schede vengono costruite dinamicamente con elementi DOM; i testi forniti dal dataset o dai servizi esterni sono inseriti come testo, non interpretati come HTML.

Le popolazioni e i PIL dei continenti sono calcolati sommando i valori presenti nel dataset. I numeri sono formattati con la locale italiana; il PIL viene mostrato in dollari statunitensi.

### Storia dei Paesi

La storia non è inclusa nel dataset: quando si seleziona un Paese, l’app interroga l’API pubblica di MediaWiki su `it.wikipedia.org`. Cerca una sezione con un titolo storico (ad esempio “Storia”, “Origini”, “Formazione” o “Indipendenza”), ne ricava i paragrafi e privilegia quelli che descrivono eventi di formazione o indipendenza. L’estratto viene abbreviato per adattarlo alla scheda.

La richiesta è asincrona. Se nel frattempo viene selezionato un altro Paese, la richiesta precedente viene annullata o ignorata, evitando che una risposta tardiva sovrascriva la scheda corrente. In caso di errore o indisponibilità della sezione viene mostrato un messaggio e un pulsante **Riprova**.

Quando la storia è disponibile, la scheda collega la voce di Wikipedia e la licenza **CC BY-SA 4.0**. Questa funzione richiede una connessione Internet; il globo e i dati locali continuano a funzionare anche senza connessione.

## Fonti e limiti dei dati

- **Geografie e dati di riferimento:** dataset basato su Natural Earth. Il sito attribuisce i confini e i dati geografici a Natural Earth e indica il pubblico dominio.
- **Libreria geografica:** D3.js 7.9.0 è inclusa localmente; la relativa licenza è in `assets/D3-LICENSE.txt`.
- **Storia:** estratti recuperati al momento della selezione da Wikipedia in italiano, con collegamento alla voce e indicazione della licenza CC BY-SA 4.0.
- **Aggiornamento:** popolazione, PIL e classificazioni economiche sono stime di riferimento, circa 2019, e non dati in tempo reale.
- **Copertura:** il dataset comprende Paesi e territori; non tutte le entità dispongono necessariamente di tutti i valori.
- **Rete:** l’unica funzione che necessita di Internet è il caricamento della storia da Wikipedia. Firewall, assenza di connessione o indisponibilità dell’API possono impedire questa richiesta.

## Avvio in locale su Windows

Aprire PowerShell e avviare un server HTTP statico dalla cartella del progetto:

```powershell
Set-Location "C:\Users\lucai\Desktop\SERF"
py -m http.server 5173
```

Aprire quindi [http://127.0.0.1:5173/](http://127.0.0.1:5173/) nel browser. Per arrestare il server, tornare alla finestra di PowerShell e premere `Ctrl+C`.

Se la porta `5173` è già occupata, scegliere un’altra porta, ad esempio:

```powershell
py -m http.server 8000
```

In questo caso l’indirizzo sarà [http://127.0.0.1:8000/](http://127.0.0.1:8000/).
