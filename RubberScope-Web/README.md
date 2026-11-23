# RubberScope Web

Die Webseite nutzt die vorhandene Auswertelogik von RubberScope 2.4. Sie bietet
Einzelbildanalyse, eine farbige Überlagerung, Kennwerte und kurze Formelherleitungen.
Die Desktop-Oberfläche mit manueller Objektkorrektur, Probenvergleich und
PDF-Protokollen bleibt Teil der separaten Desktop-Anwendung.

## Windows

1. ZIP vollständig entpacken. Python 3.12 oder 3.13 installieren und so einrichten, dass
   der Befehl python in einer Eingabeaufforderung verfügbar ist.
2. Im entpackten Ordner eine Eingabeaufforderung öffnen. Dazu in die Adressleiste
   des Explorers cmd eingeben. Einmalig die Pakete installieren.

       python -m venv .venv
       .venv\Scripts\python.exe -m pip install -r requirements.txt

3. Danach STARTEN.bat doppelklicken. Es verwendet die installierten Pakete und
   führt start.py aus. Für einen direkten Doppelklick auf start.py muss Windows
   die Datei mit Python verknüpfen. Das Skript verwendet dann ebenfalls .venv.
   Der Startbefehl in der Eingabeaufforderung lautet:

       .venv\Scripts\python.exe start.py

Der Browser öffnet sich nach dem Serverstart. Bei belegtem Port 8000
wählt das Skript einen freien Port. Die tatsächliche Adresse steht im
Konsolenfenster. Mit Strg+C beendest du den Server.

Manueller Start mit fester Adresse im Projektordner:

    .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

## Externer Betrieb

Lokal verarbeitet dein Windows-PC die Bilder und lauscht nur an 127.0.0.1.
Beim Hosting läuft dieselbe Python-App auf dem Server des Anbieters. Bilder werden
zum Server übertragen und dort für die Analyse in einem temporären Verzeichnis
abgelegt, das beim regulären Abschluss der Anfrage gelöscht wird.

Das Dockerfile kann auf einem Docker-fähigen Hostingdienst gebaut werden.
Setze dort RUBBERSCOPE_PASSWORD als geheime Umgebungsvariable. Wähle ein langes,
zufälliges ASCII-Passwort. Der Benutzername lautet rubberscope. Der Container
verlangt ein Passwort beim Start und verwendet PORT oder standardmäßig 8000.
Analysiere Bilder extern nur über HTTPS. Konfiguriere HTTPS am Hostingdienst
oder am Reverse Proxy. Für einen Server-Test am Loopback-Interface:

    docker build -t rubberscope-web .
    docker run --rm -p 127.0.0.1:8000:8000 --env RUBBERSCOPE_PASSWORD rubberscope-web

Beim zweiten Befehl muss RUBBERSCOPE_PASSWORD vorher in der Umgebung gesetzt sein.
Für eine verwaltete Plattform dient der TCP-Port als Bereitschaftsprüfung.
Die HTTP-Route /health erfordert im gehosteten Betrieb ebenfalls Anmeldung.

Dieses Paket enthält die Server-Konfiguration. Eine externe Veröffentlichung
erfordert einen Hosting-Account mit Berechtigung zum Bereitstellen.


### Bereitstellung auf Render

Die render.yaml beschreibt einen kostenlosen Docker-Webdienst in Frankfurt.
Lege die Projektdateien in ein privates Git-Repository, verbinde es bei Render
als Blueprint und setze das abgefragte Passwort. Render zeigt nach erfolgreicher
Bereitstellung die HTTPS-Adresse an. Der kostenlose Dienst eignet sich für
eine Erprobung. Speicherbedarf und Laufzeit mit typischen Bildern prüfen,
bevor die Webanwendung für reguläre Analysen verwendet wird.

https://render.com/docs/infrastructure-as-code
https://render.com/docs/docker

## Analyseverfahren und Quellen

Im Ozonrissmodus stehen Mehrskalen-Frangi und Weber-Kontrast zur Verfügung.
Beim Wechsel merkt sich die Oberfläche die Eingaben für jedes Verfahren innerhalb
der geöffneten Seite. Der JSON-Download dokumentiert die verwendete Konfiguration,
Kennwerte, Bildprüfsumme und gegebenenfalls die Robustheitsprüfung. Der
tatsächlich verwendete Maßstab und seine Quelle stehen unter metrics. Die
eingebauten Formkonstanten und Filtergrößen entsprechen RubberScope 2.4.

Die Methodenführung erklärt die Messkette von Bilddaten bis zu Unsicherheit und
Validierung. Die Quellenhinweise stehen auf Deutsch und Englisch zur Verfügung.
