'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Check, X } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

interface EditablePropertyNameProps {
  initialName: string
  propertyId: number
  onUpdate?: (newName: string) => void
}

export default function EditablePropertyName({ initialName, propertyId, onUpdate }: EditablePropertyNameProps) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.isAdmin === true
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ownerName: name.toUpperCase() }),
      })

      if (!response.ok) {
        throw new Error('Failed to update property owner name')
      }

      const updatedProperty = await response.json()
      setIsEditing(false)
      onUpdate?.(name.toUpperCase())
      toast.success('Property owner name updated successfully')
    } catch (error) {
      console.error('Error updating property owner name:', error)
      // Revert to initial name on error
      setName(initialName)
      toast.error('Failed to update property owner name')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isAdmin) {
    return <span>{name}</span>
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-48"
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave()
            } else if (e.key === 'Escape') {
              setName(initialName)
              setIsEditing(false)
            }
          }}
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
      <span>{name}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsEditing(true)}
      >
        <Pencil className="h-4 w-4" />
        <span className="sr-only">Edit owner name</span>
      </Button>
    </div>
  )
} 