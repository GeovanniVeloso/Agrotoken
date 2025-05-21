"use client"

import type React from "react"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Upload, X, FileText, ImageIcon, File, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"

type FileStatus = "idle" | "uploading" | "success" | "error"

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  status: FileStatus
  progress: number
  file: File // Armazenar o arquivo original para upload
  error?: string
}

// URL do servidor de upload usando o IP da máquina
const API_URL = "http://192.168.0.52:3005/upload"

export default function FileUploadPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Verificar autenticação ao carregar a página
  useEffect(() => {
    const isAuthenticated = sessionStorage.getItem("isAuthenticated") === "true"
    if (!isAuthenticated) {
      toast({
        title: "Acesso negado",
        description: "Você precisa fazer login para acessar esta página.",
        variant: "destructive",
      })
      router.push("/")
    }
  }, [router, toast])

  const handleLogout = () => {
    sessionStorage.removeItem("isAuthenticated")
    router.push("/")
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const validateFileType = (file: File): boolean => {
    const allowedTypes = ["application/zip", "application/pdf", "image/png", "image/jpeg", "image/jpg"]
    return allowedTypes.includes(file.type)
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const droppedFiles = Array.from(e.dataTransfer.files)

      // Validar tipos de arquivo
      const validFiles = droppedFiles.filter(validateFileType)

      if (validFiles.length !== droppedFiles.length) {
        toast({
          title: "Arquivos não suportados",
          description: "Por favor, envie apenas arquivos ZIP, PDF, PNG ou JPEG.",
          variant: "destructive",
        })
      }

      // Adicionar arquivos válidos ao estado
      const newFiles = validFiles.map((file) => ({
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
        status: "idle" as FileStatus,
        progress: 0,
        file: file,
      }))

      setFiles((prev) => [...prev, ...newFiles])
    },
    [toast],
  )

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return

    const selectedFiles = Array.from(e.target.files)

    // Validar tipos de arquivo
    const validFiles = selectedFiles.filter(validateFileType)

    if (validFiles.length !== selectedFiles.length) {
      toast({
        title: "Arquivos não suportados",
        description: "Por favor, envie apenas arquivos ZIP, PDF, PNG ou JPEG.",
        variant: "destructive",
      })
    }

    // Adicionar arquivos válidos ao estado
    const newFiles = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: "idle" as FileStatus,
      progress: 0,
      file: file,
    }))

    setFiles((prev) => [...prev, ...newFiles])

    // Resetar input de arquivo
    e.target.value = ""
  }

  const uploadFile = async (fileObj: UploadedFile) => {
    try {
      // Atualizar status para uploading
      setFiles((prev) =>
        prev.map((file) => (file.id === fileObj.id ? { ...file, status: "uploading" as FileStatus } : file)),
      )

      const formData = new FormData()
      formData.append("file", fileObj.file)

      // Criar um XMLHttpRequest para monitorar o progresso
      const xhr = new XMLHttpRequest()

      // Configurar o evento de progresso
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          setFiles((prev) => prev.map((file) => (file.id === fileObj.id ? { ...file, progress } : file)))
        }
      })

      // Configurar a promessa para o upload
      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`Erro no upload: ${xhr.status} ${xhr.statusText}`))
          }
        }
        xhr.onerror = () => reject(new Error("Erro de rede durante o upload"))
      })

      // Configurar e enviar a requisição
      xhr.open("POST", API_URL, true)
      xhr.send(formData)

      // Aguardar a conclusão do upload
      await uploadPromise

      // Atualizar status para sucesso
      setFiles((prev) =>
        prev.map((file) => (file.id === fileObj.id ? { ...file, status: "success", progress: 100 } : file)),
      )

      toast({
        title: "Upload concluído",
        description: `${fileObj.name} foi enviado com sucesso.`,
      })
    } catch (error) {
      console.error("Erro no upload:", error)

      // Atualizar status para erro
      setFiles((prev) =>
        prev.map((file) =>
          file.id === fileObj.id
            ? {
                ...file,
                status: "error",
                error: error instanceof Error ? error.message : "Erro desconhecido durante o upload",
              }
            : file,
        ),
      )

      toast({
        title: "Erro no upload",
        description: `Falha ao enviar ${fileObj.name}. Por favor, tente novamente.`,
        variant: "destructive",
      })
    }
  }

  const uploadAllFiles = async () => {
    if (files.length === 0) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione pelo menos um arquivo para enviar.",
        variant: "destructive",
      })
      return
    }

    if (isUploading) return

    setIsUploading(true)

    try {
      // Filtrar arquivos que ainda não foram enviados ou que falharam
      const filesToUpload = files.filter((file) => file.status === "idle" || file.status === "error")

      // Enviar arquivos em paralelo
      await Promise.all(filesToUpload.map((file) => uploadFile(file)))

      toast({
        title: "Uploads concluídos",
        description: "Todos os arquivos foram enviados com sucesso.",
      })
    } catch (error) {
      console.error("Erro ao enviar arquivos:", error)
      toast({
        title: "Erro nos uploads",
        description: "Ocorreram erros durante o envio dos arquivos.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== fileId))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"

    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("zip")) return <File className="h-5 w-5 text-blue-500" />
    if (fileType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />
    if (fileType.includes("image")) return <ImageIcon className="h-5 w-5 text-green-500" />
    return <File className="h-5 w-5 text-gray-500" />
  }

  const getStatusIcon = (status: FileStatus) => {
    if (status === "success") return <CheckCircle className="h-5 w-5 text-green-500" />
    if (status === "error") return <AlertCircle className="h-5 w-5 text-red-500" />
    return null
  }

  return (
    <div className="container mx-auto py-10 px-4 bg-gray-950 text-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Sistema de Upload de Arquivos</h1>
        <Button
          variant="outline"
          onClick={handleLogout}
          className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
        >
          Sair
        </Button>
      </div>

      <Card className="w-full max-w-3xl mx-auto bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Carregamento de Arquivos</CardTitle>
          <CardDescription className="text-gray-400">
            Arraste e solte arquivos ZIP ou múltiplos arquivos PDF, PNG ou JPEG
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={`border-2 border-dashed rounded-lg p-10 text-center ${
              isDragging ? "border-blue-600 bg-blue-900/20" : "border-gray-700"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <Upload className="h-12 w-12 text-gray-400" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium text-gray-200">Arraste e solte seus arquivos aqui</h3>
                <p className="text-sm text-gray-400">ou clique para selecionar arquivos</p>
                <p className="text-xs text-gray-500">Formatos suportados: ZIP, PDF, PNG, JPEG</p>
              </div>
              <label htmlFor="file-upload">
                <Button
                  variant="outline"
                  className="mt-2 border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  Selecionar Arquivos
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  multiple
                  accept=".zip,.pdf,.png,.jpg,.jpeg"
                  onChange={handleFileInputChange}
                />
              </label>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-200">Arquivos ({files.length})</h3>
              <div className="space-y-3">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center p-3 border rounded-md border-gray-700 bg-gray-800">
                    <div className="mr-3">{getFileIcon(file.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-medium truncate text-gray-200">{file.name}</p>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(file.status)}
                          <button onClick={() => removeFile(file.id)} className="text-gray-400 hover:text-gray-200">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                        <p className="text-xs text-gray-400">
                          {file.status === "uploading" ? `${file.progress}%` : ""}
                          {file.status === "error" && "Falha no upload"}
                        </p>
                      </div>
                      {file.status === "uploading" && (
                        <Progress value={file.progress} className="h-1 mt-1 bg-gray-700" />
                      )}
                      {file.error && <p className="text-xs text-red-400 mt-1">{file.error}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={uploadAllFiles}
                  disabled={isUploading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isUploading ? "Enviando..." : "Enviar Todos"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
