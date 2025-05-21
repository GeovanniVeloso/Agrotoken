import express from "express"
import multer from "multer"
import path from "path"
import fs from "fs"
import cors from "cors"

// Configuração básica do servidor
const app = express()
const PORT = 3005
const HOST = "0.0.0.0" // Escutar em todas as interfaces de rede

// Habilitar CORS para permitir requisições do frontend
app.use(cors())

// Configurar o diretório de destino para os uploads
const uploadDir = "C:\\Temp"

// Verificar se o diretório existe, se não, criar
if (!fs.existsSync(uploadDir)) {
  console.log(`Diretório ${uploadDir} não existe. Criando...`)
  try {
    fs.mkdirSync(uploadDir, { recursive: true })
    console.log(`Diretório ${uploadDir} criado com sucesso.`)
  } catch (err) {
    console.error(`Erro ao criar diretório ${uploadDir}:`, err)
    process.exit(1)
  }
}

// Configurar o multer para salvar os arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Gerar um nome de arquivo único para evitar sobrescrever arquivos
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const fileExt = path.extname(file.originalname)
    const fileName = file.originalname.replace(fileExt, "") + "-" + uniqueSuffix + fileExt
    cb(null, fileName)
  },
})

// Criar o middleware de upload com limites de tamanho
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Limite de 10MB por arquivo
  },
  fileFilter: (req, file, cb) => {
    // Verificar os tipos de arquivo permitidos
    const allowedTypes = ["application/zip", "application/pdf", "image/png", "image/jpeg", "image/jpg"]

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("Tipo de arquivo não suportado. Apenas ZIP, PDF, PNG e JPEG são permitidos."))
    }
  },
})

// Rota para upload de arquivos
app.post("/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Erro do Multer
      console.error("Erro do Multer:", err)
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message: "Arquivo muito grande. O limite é de 10MB.",
        })
      }
      return res.status(500).json({
        success: false,
        message: "Erro ao fazer upload do arquivo.",
        error: err.message,
      })
    } else if (err) {
      // Outro erro
      console.error("Erro no upload:", err)
      return res.status(400).json({
        success: false,
        message: err.message,
      })
    }

    // Se chegou aqui, o upload foi bem-sucedido
    console.log("Arquivo salvo:", req.file.path)
    return res.status(200).json({
      success: true,
      message: "Arquivo enviado com sucesso!",
      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        path: req.file.path,
      },
    })
  })
})

// Iniciar o servidor
app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`)
  console.log(`Você pode acessar usando o IP da máquina: http://192.168.0.52:${PORT}`)
  console.log(`Arquivos serão salvos em: ${uploadDir}`)
})

// Tratamento de erros não capturados
process.on("uncaughtException", (err) => {
  console.error("Erro não tratado:", err)
})
