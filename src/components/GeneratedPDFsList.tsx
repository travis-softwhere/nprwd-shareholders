"use client"

import { useState, useEffect } from "react"
import { useMeeting } from "@/contexts/MeetingContext"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { FileText, Download, Loader2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"

interface GeneratedPDF {
  url: string
  fileName: string
  createdAt: string
  size: number
}

export function GeneratedPDFsList() {
  const { selectedMeeting } = useMeeting()
  const { toast } = useToast()
  const [pdfs, setPdfs] = useState<GeneratedPDF[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{ [url: string]: number }>({})

  useEffect(() => {
    const fetchPDFs = async () => {
      if (!selectedMeeting) return
      
      try {
        setIsLoading(true)
        const response = await fetch(`/api/generated-pdfs?meetingId=${selectedMeeting.id}`)
        if (!response.ok) throw new Error('Failed to fetch PDFs')
        
        const data = await response.json()
        setPdfs(data.pdfs)
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load generated PDFs",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchPDFs()
  }, [selectedMeeting, toast])

  const handleDownload = async (pdf: GeneratedPDF) => {
    try {
      setDownloadProgress((prev) => ({ ...prev, [pdf.url]: 0 }))

      const response = await fetch(pdf.url)
      if (!response.ok) throw new Error('Failed to download PDF')
      
      const contentLength = response.headers.get('content-length')
      const total = contentLength ? parseInt(contentLength, 10) : 0
      const reader = response.body?.getReader()
      let received = 0
      const chunks = []

      while (true) {
        const { done, value } = await reader!.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (total) {
          setDownloadProgress((prev) => ({
            ...prev,
            [pdf.url]: Math.round((received / total) * 100),
          }))
        }
      }

      // Combine chunks into a blob
      const blob = new Blob(chunks, { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdf.fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      setDownloadProgress((prev) => ({ ...prev, [pdf.url]: 100 }))
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download PDF",
        variant: "destructive",
      })
      setDownloadProgress((prev) => ({ ...prev, [pdf.url]: 0 }))
    }
  }

  // Download all PDFs (sequentially)
  const handleDownloadAll = async () => {
    for (const pdf of pdfs) {
      await handleDownload(pdf)
    }
  }

  if (!selectedMeeting) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Generated PDFs</h3>
        <div className="flex items-center gap-2">
          {pdfs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              className="text-blue-600 hover:text-blue-700"
              disabled={isLoading}
            >
              <Download className="h-4 w-4 mr-1" />
              Download All
            </Button>
          )}
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      </div>
      
      {pdfs.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No PDFs generated yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[352px] overflow-y-auto overflow-x-hidden w-full">
          {pdfs.map((pdf) => (
            <div
              key={pdf.url}
              className="flex flex-col p-3 bg-white border rounded-lg hover:bg-gray-50 w-full"
            >
              <div className="flex items-center space-x-3 w-full">
                <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div className="min-w-0 w-full">
                  <p className="font-medium truncate w-full">{pdf.fileName}</p>
                  <p className="text-sm text-gray-500 truncate w-full">
                    {new Date(pdf.createdAt).toLocaleDateString()} • {(pdf.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 mt-2 w-full">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(pdf)}
                  className="text-blue-600 hover:text-blue-700"
                  disabled={!!downloadProgress[pdf.url] && downloadProgress[pdf.url] < 100}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                {downloadProgress[pdf.url] > 0 && downloadProgress[pdf.url] < 100 && (
                  <Progress value={downloadProgress[pdf.url]} className="h-2 flex-1 min-w-0" />
                )}
                {downloadProgress[pdf.url] === 100 && (
                  <div className="text-green-600 text-xs ml-2">Done</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 