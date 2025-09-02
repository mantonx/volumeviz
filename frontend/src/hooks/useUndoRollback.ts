import { useState, useCallback } from 'react'

export interface Operation {
  id: string
  type: 'delete' | 'move' | 'copy' | 'rename'
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back'
  volumeId: string
  description: string
  createdAt: string
  completedAt?: string
  actions: OperationAction[]
  metadata: OperationMetadata
}

export interface OperationAction {
  id: string
  type: 'delete' | 'move' | 'copy' | 'rename'
  sourcePath: string
  targetPath?: string
  fileSize: number
  status: string
  executedAt?: string
  backupPath?: string
  errorMessage?: string
}

export interface OperationMetadata {
  totalFiles: number
  processedFiles: number
  totalSizeBytes: number
  savedSpaceBytes?: number
  workflowId?: string
  riskLevel?: string
}

export interface RollbackRequest {
  operationId: string
  actionIds?: string[]
  reason?: string
}

export interface RollbackResponse {
  success: boolean
  rolledBack: string[]
  failed: RollbackFailure[]
  operationId: string
  completedAt: string
}

export interface RollbackFailure {
  actionId: string
  errorMessage: string
  reason: string
}

export interface OperationHistory {
  operations: Operation[]
  pagination: {
    page: number
    pageSize: number
    total: number
    pages: number
  }
}

export interface UseUndoRollbackOptions {
  volumeId: string
  pageSize?: number
  onOperationRollback?: (operationId: string, response: RollbackResponse) => void
  onError?: (error: string) => void
}

export interface UseUndoRollbackReturn {
  // State
  operations: Operation[]
  loading: boolean
  error: string | null
  currentPage: number
  totalPages: number
  rollbackLoading: Set<string>

  // Actions
  loadOperations: (page?: number) => Promise<void>
  rollbackOperation: (operationId: string, actionIds?: string[], reason?: string) => Promise<RollbackResponse | null>
  deleteOperation: (operationId: string) => Promise<void>
  cleanupBackups: (retentionDays?: number) => Promise<void>
  refreshOperations: () => Promise<void>
  
  // Computed
  hasOperations: boolean
  canLoadMore: boolean
}

export function useUndoRollback(options: UseUndoRollbackOptions): UseUndoRollbackReturn {
  const { volumeId, pageSize = 20, onOperationRollback, onError } = options

  // State
  const [operations, setOperations] = useState<Operation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [rollbackLoading, setRollbackLoading] = useState<Set<string>>(new Set())

  // Load operations history
  const loadOperations = useCallback(async (page: number = 1) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/v1/operations?volume_id=${encodeURIComponent(volumeId)}&page=${page}&page_size=${pageSize}`
      )

      if (!response.ok) {
        throw new Error('Failed to load operations')
      }

      const data: OperationHistory = await response.json()
      
      if (page === 1) {
        setOperations(data.operations)
      } else {
        setOperations(prev => [...prev, ...data.operations])
      }
      
      setCurrentPage(page)
      setTotalPages(data.pagination.pages)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load operations'
      setError(errorMessage)
      if (onError) {
        onError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }, [volumeId, pageSize, onError])

  // Rollback operation
  const rollbackOperation = useCallback(async (
    operationId: string, 
    actionIds?: string[], 
    reason?: string
  ): Promise<RollbackResponse | null> => {
    setRollbackLoading(prev => new Set([...prev, operationId]))

    try {
      const request: RollbackRequest = {
        operationId,
        actionIds,
        reason,
      }

      const response = await fetch(
        `/api/v1/operations/${operationId}/rollback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to rollback operation')
      }

      const rollbackResponse: RollbackResponse = await response.json()

      // Update local state
      setOperations(prev =>
        prev.map(op =>
          op.id === operationId
            ? { ...op, status: 'rolled_back' as const }
            : op
        )
      )

      if (onOperationRollback) {
        onOperationRollback(operationId, rollbackResponse)
      }

      return rollbackResponse
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rollback operation'
      setError(errorMessage)
      if (onError) {
        onError(errorMessage)
      }
      return null
    } finally {
      setRollbackLoading(prev => {
        const next = new Set(prev)
        next.delete(operationId)
        return next
      })
    }
  }, [onOperationRollback, onError])

  // Delete operation
  const deleteOperation = useCallback(async (operationId: string) => {
    try {
      const response = await fetch(`/api/v1/operations/${operationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete operation')
      }

      // Remove from local state
      setOperations(prev => prev.filter(op => op.id !== operationId))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete operation'
      setError(errorMessage)
      if (onError) {
        onError(errorMessage)
      }
    }
  }, [onError])

  // Cleanup backups
  const cleanupBackups = useCallback(async (retentionDays: number = 30) => {
    try {
      const response = await fetch(
        `/api/v1/operations/cleanup?retention_days=${retentionDays}`,
        { method: 'POST' }
      )

      if (!response.ok) {
        throw new Error('Failed to cleanup backups')
      }

      // Refresh operations to reflect changes
      await loadOperations(1)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cleanup backups'
      setError(errorMessage)
      if (onError) {
        onError(errorMessage)
      }
    }
  }, [loadOperations, onError])

  // Refresh operations
  const refreshOperations = useCallback(async () => {
    await loadOperations(1)
  }, [loadOperations])

  // Computed values
  const hasOperations = operations.length > 0
  const canLoadMore = currentPage < totalPages

  return {
    // State
    operations,
    loading,
    error,
    currentPage,
    totalPages,
    rollbackLoading,

    // Actions
    loadOperations,
    rollbackOperation,
    deleteOperation,
    cleanupBackups,
    refreshOperations,

    // Computed
    hasOperations,
    canLoadMore,
  }
}