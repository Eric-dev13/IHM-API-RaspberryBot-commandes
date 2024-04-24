/* *******************************************************************
  INITIALISATION DES VARIABLES 
******************************************************************* */

// Importation des modules nécessaires
const express = require('express'); // Importation du module Express pour la gestion du serveur HTTP
const { createServer } = require('node:http'); // Création d'un serveur HTTP avec le module natif 'http'
const { Server } = require('socket.io'); // Importation du module Socket.IO pour la communication en temps réel

// Initialisation d'une application Express
const app = express();

// Création d'un serveur HTTP à partir de l'application Express
const server = createServer(app);

// Définition du port sur lequel le serveur écoutera les requêtes
const port = 3000;

// Initialisation de Socket.IO en utilisant le serveur HTTP
const io = new Server(server);

// Importation du module SerialPort pour la communication série
const { SerialPort } = require('serialport');

// Importation du module ReadlineParser pour analyser les données série
const { ReadlineParser } = require('@serialport/parser-readline');

// Déclaration des variables pour la communication série
let serialPortArduino; // Référence au port série avec l'Arduino
let MessageOfSerialPort; // Stockage des messages transmis via le port série



/* ****************************************************************************************************************************** *
*                                                SERVER JS                                                                        *
* ------------------------------------------------------------------------------------------------------------------------------- */
const startWebServer = () => {
    /*  Ce middleware gère les en-têtes CORS (Cross-Origin Resource Sharing) 
        et permets au serveur d'accepter des requêtes provenant de n'importe quel domaines. */
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
        next();
    });

    const myserver = app.listen(port, () => {
        console.log('Connection avec le server établit : IP pour l\'interface de commande http://localhost:' + port + ' !');
    });

    /* ******************
    *     SOCKET.IO     *
    ******************* */
    io.sockets.on('connection', (socket) => {
        // QUAND UN CLIENT SE CONNECTE
        // on le note dans la console
        console.log('Un client est connecté !');

        // On informe le client qu'il est connecté
        io.sockets.emit('messageFromServer', 'Vous êtes connecté au serveur !');

        // Envoi l'état du port sérial au client
        console.log(MessageOfSerialPort);
        io.sockets.emit('messageFromServer', MessageOfSerialPort);

        // On écoute les requetes du client et on envoie la commande à l'arduino
        socket.on('commande', (action) => {
            console.log('message du client : ' + action);
            serialPortArduino.write(action);
        });
    });

    app.get('/', (req, res) => {
        res.send('<h2>Bienvenue sur l\'interface de commande !</h2>');
    });

    // DEFINIT L'ACTION A REALISER ET ENVOIE DE LA COMMANDE VIA LE PORT SERIE (WRITE)
    app.get('/commandes/:action', (req, res) => {
        let action = req.params.action;
        //console.log("Action demandé: ", action)
        serialPortArduino.write(action);
        io.sockets.emit('messageFromServer', action);
    });

}


/* ************************************************************************************ *
*                                       SERIAL PORT                                     *
* ------------------------------------------------------------------------------------- *
*                                                                                       *
* ************************************************************************************* */
// Fonction pour rechercher le port série de l'Arduino
const findArduinoPort = () => {
    SerialPort.list().then((ports) => {
        console.log(`Nombre de ports série disponibles : ${ports.length}`)
        console.log('Informations du port série :', ports)
        ports.forEach(port => {
            if (port.vendorId === '2a03' && port.productId === '0042') {
                console.log('Port série de l\'Arduino trouvé :', port.path)
                initSerialCommunication(port.path)
            }
        });
    })
}

// Fonction pour initialiser la communication série avec le port spécifié
const initSerialCommunication = (portName) => {
    // INITIALISE LA COMMUNICATION - Créer une instance de port série avec le nom du port et le débit binaire spécifié.
    serialPortArduino = new SerialPort({ path: portName, baudRate: 9600 })

    // OUVERTURE DU PORT SERIE - Écouter l'événement 'open' pour savoir quand le port série est ouvert avec succès.
    serialPortArduino.on('open', () => {
        const MessageOfSerialPort = 'Le port serie ' + portName + ' est ouvert.';
        console.log(MessageOfSerialPort);
        io.sockets.emit('messageFromServer', MessageOfSerialPort);
        // Démarrer le serveur web et écoute le requete entrante
        startWebServer();
    });

    // ERREUR D'OUVERTURE DU PORT SERIE  
    serialPortArduino.on('error', () => {
        MessageOfSerialPort = 'Erreur lors de l\'ouverture du port : ' + PortCOM + '.';
        console.error(MessageOfSerialPort);
        io.sockets.emit('messageFromServer', MessageOfSerialPort);
    });

    // FERMETURE DU PORT SERIE  
    serialPortArduino.on('close', (error) => {
        MessageOfSerialPort = 'Le port serie ' + PortCOM + ' à été fermé.';
        console.log(MessageOfSerialPort);
        io.sockets.emit('messageFromServer', MessageOfSerialPort);
    });

    // Créer un parseur de ligne pour lire les données sérialisées ligne par ligne
    const parser = serialPortArduino.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    // AFFICHE LES DONNEES RECU VIA LE PORT SERIE
    parser.on('data', (data) => {
        console.log("Arduino émission de données :  " + data);
        io.sockets.emit('messageFromServer', "Arduino émission de données :  " + data);
    });

    // Gérer les erreurs de port série
    serialPortArduino.on('error', (err) => {
        console.error('Erreur de port série :', err);
    });
}


/* ************************************************************************************ *
*                                  INITIALISATION                                       *
* ------------------------------------------------------------------------------------- *
*                                                                                       *
* ************************************************************************************* */
findArduinoPort();
