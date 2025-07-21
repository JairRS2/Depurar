// app.js
const express = require('express');
const sql = require('mssql');
const path = require('path');
require('dotenv').config(); // Para cargar variables de entorno desde un archivo .env

const app = express();
const port = process.env.PORT || 3000; // Puedes cambiar el puerto si es necesario

// Middleware para servir archivos estáticos (como index.html)
app.use(express.static(path.join(__dirname, 'templates')));
// Middleware para parsear cuerpos de solicitud JSON
app.use(express.json());

// --- Configuración de la Conexión a la Base de Datos ---
// IMPORTANTE: Reemplaza estos valores con los de tu propio servidor SQL Server.
// Se recomienda encarecidamente usar variables de entorno para las credenciales en producción.
const dbConfig = {
    user: process.env.DB_USER || 'TU_USUARIO_SQL',
    password: process.env.DB_PASSWORD || 'TU_CONTRASEÑA_SQL',
    server: process.env.DB_SERVER || 'TU_SERVIDOR_SQL', // Ej: 'localhost', '192.168.1.100', 'NOMBRE_DEL_SERVIDOR\\INSTANCIA'
    database: process.env.DB_DATABASE || 'TU_BASE_DE_DATOS',
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true', // Usar true para Azure SQL Database, false para SQL Server local
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true', // Cambiar a true para certificados autofirmados
        enableArithAbort: true, // Recomendado para evitar errores de truncamiento
        port: parseInt(process.env.DB_PORT || '1433') // Puerto por defecto de SQL Server
    }
};

// Ruta principal que sirve la página HTML con el botón
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// Ruta que maneja la solicitud de limpieza de la base de datos
app.post('/clean_database', async (req, res) => {
    let pool;
    try {
        console.log("Intentando conectar a la base de datos...");
        // Crea un pool de conexiones para manejar múltiples conexiones de forma eficiente
        pool = await sql.connect(dbConfig);
        console.log("Conexión exitosa a la base de datos.");

        // Iniciar una transacción para asegurar la atomicidad de las operaciones
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        const request = new sql.Request(transaction);

        // --- Limpieza de tablas ---

        // 1. Truncar tablas (borra todos los registros de forma rápida y reinicia la identidad)
        const tablasATruncar = ['tbKardex', 'tbOrden', 'tbDespUrea'];
        for (const tabla of tablasATruncar) {
            console.log(`Truncando tabla: ${tabla}...`);
            await request.query(`TRUNCATE TABLE ${tabla};`);
            console.log(`Tabla ${tabla} truncada exitosamente.`);
        }

        // 2. Actualizar columnas específicas en tbInventario
        console.log("Actualizando columnas en tbInventario...");
        // Establecemos los valores a 0. Si prefieres NULL, cambia 0 por NULL.
        const updateInventarioSql = `
            UPDATE tbInvUrea
            SET nExiMir = 0,
                nExiSis = 0,
                nUltCos = 0,
                nPreProm = 0;
        `;
        await request.query(updateInventarioSql);
        console.log("Columnas nExiMir, nExiSis, nUltCos, nPreProm en tbInventario actualizadas a 0.");

        // Confirmar los cambios en la base de datos
        await transaction.commit();
        console.log("Todos los cambios han sido confirmados exitosamente.");
        res.json({ status: "success", message: "Tablas limpiadas exitosamente." });

    } catch (err) {
        console.error("Error al conectar o ejecutar la consulta:", err.message);
        if (pool && pool.connected) {
            // Si hay un pool de conexiones y está conectado, intenta hacer rollback
            try {
                const transaction = new sql.Transaction(pool);
                await transaction.rollback();
                console.log("Se ha realizado un rollback debido al error.");
            } catch (rollbackErr) {
                console.error("Error al intentar rollback:", rollbackErr.message);
            }
        }
        res.status(500).json({ status: "error", message: `Error en la operación de base de datos: ${err.message}` });
    } finally {
        // Cerrar el pool de conexiones si existe
        if (pool && pool.connected) {
            await pool.close();
            console.log("Conexión a la base de datos cerrada.");
        }
    }
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor Node.js escuchando en http://localhost:${port}`);
    console.log('Abre tu navegador y visita esta dirección.');
});