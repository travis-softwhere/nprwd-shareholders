'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Check, X } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface EditableNameProps {
  initialName: string
  shareholderId: string
}

export default function EditableName({ initialName, shareholderId }: EditableNameProps) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.isAdmin === true
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/shareholders/${shareholderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        throw new Error('Failed to update name')
      }

      setIsEditing(false)
    } catch (error) {
      console.error('Error updating name:', error)
      // Revert to initial name on error
      setName(initialName)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{name}</h1>
      </div>
    )
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-64"
          disabled={isLoading}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          disabled={isLoading}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setName(initialName)
            setIsEditing(false)
          }}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="text-2xl font-bold">{name}</h1>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsEditing(true)}
      >
        <Pencil className="h-4 w-4" />
        <span className="sr-only">Edit name</span>
      </Button>
    </div>
  )
} 