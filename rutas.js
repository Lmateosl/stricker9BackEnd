const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } = require('firebase/auth');
const { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, addDoc, updateDoc } = require('firebase/firestore');
const axios = require('axios');
const moment = require('moment-timezone');

require('dotenv').config();

const firebaseConfig = {
    apiKey: process.env.API_KEY_FIREBASE,
    authDomain: process.env.AUTH_DOMAIN_FIREBASE,
    projectId: process.env.PROJECT_ID_FIREBASE,
    storageBucket: process.env.STORAGE_BUCKET_FIREBASE,
    messagingSenderId: process.env.MESSAGING_FIREBASE,
    appId: process.env.APP_ID_FIREBASE,
    measurementId: process.env.MESURAMENT_ID_FIRABASE
  };

// Inicializar la aplicación de Firebase
const app = initializeApp(firebaseConfig);

// Obtener una instancia del objeto de autenticación de Firebase
const auth = getAuth(app);

// Obtener una instancia del objeto de Firestore de Firebase
const db = getFirestore(app);

// Crear un usuario y guardarlo en Firestore
router.post('/signup', async (req, res) => {
  try {
    const { nombre, cedula, telefono, mail, contrasena, reservas } = req.body;

    console.log(req.body);

    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, mail, contrasena);
    const user = userCredential.user;
    const uid = user.uid;

    // Crear documento de usuario en Firestore
    const usuariosRef = collection(db, 'usuarios');
    const usuarioData = {
      nombre,
      cedula,
      telefono,
      mail,
      reservas,
      uid
    };
    await setDoc(doc(usuariosRef, user.uid), usuarioData);

    const token = jwt.sign({ uid }, process.env.SECRET_KEY, { expiresIn: '24h' });

    res.status(200).json({ message: 'Usuario creado exitosamente', token: token });
  } catch (error) {
    console.error('Error al crear el usuario:', error);
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

function generarCodigo() {
  let codigo = '';
  for (let i = 0; i < 6; i++) {
    const numeroAleatorio = Math.floor(Math.random() * 10); // Genera un número aleatorio entre 0 y 9
    codigo += numeroAleatorio;
  }
  return codigo;
}

router.post('/codigo', async (req, res) => {
  try {
    const { numero } = req.body;
    const codigo = generarCodigo().toString();

    const response = await axios.post('https://graph.facebook.com/v17.0/111392462006335/messages', {
      "messaging_product": "whatsapp",
      "recipient_type": "individual",
      "to": numero,
      "type": "template",
      "template": {
        "name": "codigo",
        "language": {
          "code": "es"
      },
        "components": [
          {
            "type": "body",
            "parameters": [
              {
                "type": "text",
                "text": codigo
              }
            ]
          },
          {
            "type": "button",
            "sub_type": "url",
            "index": "0",
            "parameters": [
              {
                "type": "text",
                "text": codigo
              }
            ]
          }
        ]
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization':  process.env.API_KEY_WHA // Reemplaza esto con tu token de autorización
      }
    });

    // Devuelve la respuesta de la API de Facebook al usuario
    res.json({codigo: codigo});
  } catch (error) {
    // Maneja cualquier error que ocurra durante la solicitud
    console.error(error);
    res.status(500).json({ error: 'Error al llamar a la API de Facebook' });
  }
});



// Ruta para iniciar sesión
router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Iniciar sesión con Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const uid = user.uid;

      const token = jwt.sign({ uid }, process.env.SECRET_KEY, { expiresIn: '24h' });
  
      res.status(200).json({ message: 'Estas adentro.', token: token });
    } catch (error) {
      console.log(error);
      if (error.code === 'auth/wrong-password') {
        // Manejar el error de contraseña incorrecta
        res.status(401).json({ error: 'Contraseña incorrecta' });
      } else if (error.code === 'auth/user-not-found') {
        // Manejar el error de usuario no encontrado
        res.status(401).json({ error: 'Usuario no encontrado' });
      } else if(error.code === 'auth/too-many-requests'){
        res.status(401).json({ error: 'Sobrapaste los intentos permitidos, vuelve a intentar en unos minutos.' });
      } else {
        // Manejar otros errores de Firebase o del servidor
        console.error(error.message);
        res.status(500).json({ error: 'Ocurrió un error en el servidor' });
      }
    }
});

router.post('/pass', async (req, res) => {
  try {
    const { email } = req.body;

    // Enviar correo de restablecimiento de contraseña
    await sendPasswordResetEmail(auth, email);

    res.status(200).json({ message: 'Se ha enviado un correo para restablecer la contraseña' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ocurrió un error al enviar el correo de restablecimiento de contraseña' });
  }
});

router.get('/datosUsuario', async (req, res) => {
  console.log(req.headers);
  try {
    const token = req.headers.authorization;
    
    // Verificar y decodificar el token
    const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
    const userId = decodedToken.uid;

    /// Consulta Firestore para obtener los datos del usuario
    const usuariosRef = collection(db, 'usuarios');
    const usuarioDoc = await getDoc(doc(usuariosRef, userId));
    
    if (!usuarioDoc.exists) {
      // Si el documento no existe, devuelve un error o mensaje adecuado
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
  
    // Obtiene los datos del usuario y los envía en la respuesta
    const usuarioData = usuarioDoc.data();
    res.status(200).json(usuarioData);

  } catch (error) {
    console.error('Error al obtener los datos del usuario:', error);
    res.status(500).json({ error: 'Error al obtener los datos del usuario' });
  }
});

router.get('/getCanchas', async (req, res) => {
  try {

    // Consultar Firestore para obtener los datos de la colección "canchas"
    const canchasRef = collection(db, 'canchas');
    const canchasSnapshot = await getDocs(canchasRef);
    const canchas = canchasSnapshot.docs.map(doc => doc.data());

    // Enviar los datos de las canchas en la respuesta
    res.status(200).json(canchas);
  } catch (error) {
    console.error('Error al obtener las canchas:', error);
    res.status(500).json({ error: 'Error al obtener las canchas' });
  }
});

router.get('/getDatosCancha', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const position = req.query.position; // Obtener la posición del elemento del array

    // Verificar y decodificar el token JWT
    const decodedToken = jwt.verify(token, process.env.SECRET_KEY);
    // Aquí puedes realizar cualquier validación adicional necesaria utilizando la información del token

    // Consultar Firestore para obtener los datos de la cancha específica
    const canchaRef = doc(collection(db, 'canchas'), position);
    const canchaSnapshot = await getDoc(canchaRef);

    if (!canchaSnapshot.exists()) {
      return res.status(404).json({ error: 'Cancha no encontrada' });
    }

    const canchaData = canchaSnapshot.data();

    // Obtener la colección "campos" dentro de la cancha
    const camposRef = collection(canchaRef, 'campos');
    const camposSnapshot = await getDocs(camposRef);
    const camposData = camposSnapshot.docs.map(doc => doc.data());

    // Agregar los datos de la colección "campos" a la cancha
    canchaData.campos = camposData;

    // Enviar los datos completos de la cancha en la respuesta
    res.status(200).json(canchaData);
  } catch (error) {
    console.error('Error al obtener los datos de la cancha:', error);
    res.status(500).json({ error: 'Error al obtener los datos de la cancha' });
  }
});

router.post('/reservas', async (req, res) => {
  const { idCancha, idCampo, fecha } = req.body;
  const token = req.headers.authorization;

  // Verificar y decodificar el token JWT
  const decodedToken = jwt.verify(token, process.env.SECRET_KEY);

  try {
    const q = query(
      collection(db, 'reservas'),
      where('idCancha', '==', idCancha),
      where('idCampo', '==', idCampo),
      where('fecha', '==', fecha)
    );

    const querySnapshot = await getDocs(q);

    const reservas = [];
    querySnapshot.forEach((doc) => {
      const reserva = doc.data();
      reservas.push(reserva);
    });

    res.json(reservas);
  } catch (error) {
    console.error('Error al obtener las reservas:', error);
    res.status(500).json({ error: 'Error al obtener las reservas' });
  }
});

// Ruta POST /crearReserva
router.post('/crearReserva', async (req, res) => {
  const { cedula, fecha, hora, idCampo, idCancha, nombre, numero, uid, nombreCancha, numeroCancha } = req.body;
  const token = req.headers.authorization;

  // Verificar y decodificar el token JWT
  const decodedToken = jwt.verify(token, process.env.SECRET_KEY);

  // Verificar que los campos obligatorios estén presentes
  if (!idCancha || !idCampo || !cedula || !numero || !nombre || !fecha || !hora || !nombreCancha || !numeroCancha) {
    return res.status(400).json({ message: 'Faltan campos obligatorios' });
  }

  try {
    // Buscar reservas con los mismos datos
    const q = query(collection(db, 'reservas'), where('idCancha', '==', idCancha), where('idCampo', '==', idCampo), where('fecha', '==', fecha), where('hora', '==', hora));
    const querySnapshot = await getDocs(q);

    // Si hay reservas con los mismos datos, enviar mensaje de error
    if (querySnapshot.size > 0) {
      return res.status(409).json({ message: 'Esta hora ya está reservada' });
    }

    // Crear la reserva
    const reservaData = {
      cedula,
      fecha,
      hora,
      idCampo,
      idCancha,
      nombre,
      numero,
      uid: uid || '',
    };

    const docRef = await addDoc(collection(db, 'reservas'), reservaData);

    // Actualizar el documento de reserva con el atributo "id"
    const docId = docRef.id;
    const reservaRef = doc(db, 'reservas', docId);
    await updateDoc(reservaRef, { id: docId });

    //Enviar mensaje de cofirmacion wha
    const mensaje = await enviarMensajeReservaHecha(numero, nombre);
    // Devolver mensaje de éxito con el ID de la reserva
    return res.status(200).json({ message: 'Reserva realizada con éxito', id: docRef.id });
  } catch (error) {
    console.error('Error al crear la reserva:', error);
    return res.status(500).json({ message: 'Error al crear la reserva' });
  }
});

async function enviarMensajeReservaHecha (numero, nombre) {
  const response = await axios.post('https://graph.facebook.com/v17.0/111392462006335/messages', {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": numero,
    "type": "template",
    "template": {
      "name": "reserva_confirmacion",
      "language": {
        "code": "es"
    },
      "components": [
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "text": nombre
            }
          ]
        }
      ]
    }
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization':  process.env.API_KEY_WHA // Reemplaza esto con tu token de autorización
    }
  });
}

router.post('/reservasUsuario', async (req, res) => {
  const { numero } = req.body;
  const token = req.headers.authorization;

  // Verificar y decodificar el token JWT
  const decodedToken = jwt.verify(token, process.env.SECRET_KEY);

  // Verificar que se reciba la cédula
  if (!numero) {
    return res.status(400).json({ message: 'Falta el numero del usuario' });
  }

  try {

    // Consultar las reservas del usuario por cédula
    const q = query(collection(db, 'reservas'), where('numero', '==', numero));
    const querySnapshot = await getDocs(q);

    // Crear un array con los datos de las reservas encontradas
    const reservas = [];
    querySnapshot.forEach((doc) => {
      const reserva = doc.data();
      reservas.push(reserva);
    });



    // Devolver las reservas encontradas como respuesta
    return res.status(200).json(reservas);
  } catch (error) {
    console.error('Error al obtener las reservas del usuario:', error);
    return res.status(500).json({ message: 'Error al obtener las reservas del usuario' });
  }
});

// Ruta GET /horaGuayaquil
router.get('/horaGuayaquil', (req, res) => {
  const token = req.headers.authorization;

  // Verificar y decodificar el token JWT
  const decodedToken = jwt.verify(token, process.env.SECRET_KEY);

  try {
    const serverTime = moment().tz('UTC'); // Obtener la hora local del servidor en formato UTC
    const ecuadorTime = serverTime.clone().tz('America/Guayaquil'); // Convertir la hora a la zona horaria de Guayaquil
  
    const horaGuayaquil = ecuadorTime.format('HH:mm:ss'); // Formato de hora: HH:mm:ss
    const fechaGuayaquil = ecuadorTime.format('YYYY-MM-DD'); // Formato de fecha: YYYY-MM-DD

    console.log(horaGuayaquil, fechaGuayaquil);
  
    return res.status(200).json({ horaGuayaquil, fechaGuayaquil });
  } catch (error) {
    console.error('Error al obtener la hora:', error);
    return res.status(500).json({ message: 'Error al obtener la hora local' });
  }

});

// Ruta POST para eliminar reservas pasadas
router.post('/reservasPasadas', async (req, res) => {
  const token = req.headers.authorization;

  // Verificar y decodificar el token JWT
  const decodedToken = jwt.verify(token, process.env.SECRET_KEY);

  try {
    const idsArray = req.body; // Suponiendo que el array de IDs viene en el cuerpo de la solicitud

    // Verificar si el array de IDs está presente en la solicitud y no está vacío
    if (!Array.isArray(idsArray) || idsArray.length === 0) {
      return res.status(400).json({ message: 'El array de IDs debe ser proporcionado en la solicitud.' });
    }

    // Crear una referencia a la colección 'reservas'
    const reservasRef = db.collection('reservas');

    // Obtener todos los documentos cuyas IDs coincidan con los IDs del array
    const reservasSnapshot = await reservasRef.where('id', 'in', idsArray).get();

    // Crear un arreglo de promesas para eliminar los documentos
    const deletePromises = [];
    reservasSnapshot.forEach((doc) => {
      const reservaRef = reservasRef.doc(doc.id);
      deletePromises.push(reservaRef.delete());
    });

    // Esperar a que todas las promesas de eliminación se resuelvan
    await Promise.all(deletePromises);

    return res.status(200).json({ message: 'Reservas pasadas eliminadas.' });
  } catch (error) {
    console.error('Error al eliminar las reservas pasadas:', error);
    return res.status(500).json({ message: 'Error al eliminar las reservas pasadas.' });
  }
});


module.exports = router;

