export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type EmployeeRole = 'ceo' | 'finance' | 'staff'
export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'other'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type RecurringInterval = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type BudgetPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type ReceiptStatus = 'pending' | 'approved' | 'rejected'
export type ApprovalAction = 'approved' | 'rejected'

export type Database = {
  public: {
    Tables: {
      receipts: {
        Row: {
          id: string
          employee_id: string
          employee_name: string
          department: string
          amount: number
          merchant_name: string
          date: string
          memo: string | null
          image_url: string | null
          category: string
          status: ReceiptStatus
          rejection_comment: string | null
          rejection_notified_at: string | null
          is_manual_review: boolean
          supply_value: number | null
          vat: number | null
          tax_free_amount: number | null
          submitted_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          employee_name: string
          department: string
          amount: number
          merchant_name: string
          date: string
          memo?: string | null
          image_url?: string | null
          category?: string
          status?: ReceiptStatus
          rejection_comment?: string | null
          rejection_notified_at?: string | null
          is_manual_review?: boolean
          supply_value?: number | null
          vat?: number | null
          tax_free_amount?: number | null
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          merchant_name?: string
          date?: string
          memo?: string | null
          image_url?: string | null
          category?: string
          status?: ReceiptStatus
          rejection_comment?: string | null
          rejection_notified_at?: string | null
          is_manual_review?: boolean
          supply_value?: number | null
          vat?: number | null
          tax_free_amount?: number | null
          updated_at?: string
        }
      }
      approvals: {
        Row: {
          id: string
          receipt_id: string
          approver_id: string
          approver_name: string
          action: ApprovalAction
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          receipt_id: string
          approver_id: string
          approver_name: string
          action: ApprovalAction
          comment?: string | null
          created_at?: string
        }
        Update: Record<string, never>
      }
      department_budgets: {
        Row: {
          id: string
          department: string
          month: string
          budget_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          department: string
          month: string
          budget_amount: number
          created_at?: string
        }
        Update: {
          budget_amount?: number
        }
      }
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          type: AccountType
          currency: string
          balance: number
          institution: string | null
          account_number: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: AccountType
          currency?: string
          balance?: number
          institution?: string | null
          account_number?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: AccountType
          currency?: string
          balance?: number
          institution?: string | null
          account_number?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          account_id: string
          category_id: string | null
          amount: number
          currency: string
          type: TransactionType
          description: string
          memo: string | null
          date: string
          is_recurring: boolean
          recurring_interval: RecurringInterval | null
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          account_id?: string | null
          category_id?: string | null
          amount: number
          currency?: string
          type: TransactionType
          description: string
          memo?: string | null
          date: string
          is_recurring?: boolean
          recurring_interval?: RecurringInterval | null
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          category_id?: string | null
          amount?: number
          currency?: string
          type?: TransactionType
          description?: string
          memo?: string | null
          date?: string
          is_recurring?: boolean
          recurring_interval?: RecurringInterval | null
          tags?: string[]
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string | null
          name: string
          type: TransactionType
          color: string
          icon: string | null
          parent_id: string | null
          is_system: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          type: TransactionType
          color?: string
          icon?: string | null
          parent_id?: string | null
          is_system?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          type?: TransactionType
          color?: string
          icon?: string | null
          parent_id?: string | null
        }
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          name: string
          amount: number
          currency: string
          period: BudgetPeriod
          start_date: string
          end_date: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id?: string | null
          name: string
          amount: number
          currency?: string
          period: BudgetPeriod
          start_date: string
          end_date?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          name?: string
          amount?: number
          currency?: string
          period?: BudgetPeriod
          start_date?: string
          end_date?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      employees: {
        Row: {
          id: string
          user_id: string
          email: string
          name: string
          role: EmployeeRole
          department: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          name: string
          role: EmployeeRole
          department?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          name?: string
          role?: EmployeeRole
          department?: string | null
          is_active?: boolean
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          default_currency: string
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          default_currency?: string
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          default_currency?: string
          timezone?: string
          updated_at?: string
        }
      }
    }
    Views: {
      monthly_summary: {
        Row: {
          user_id: string | null
          year: number | null
          month: number | null
          total_income: number | null
          total_expense: number | null
          net: number | null
        }
      }
    }
    Functions: {
      get_budget_utilization: {
        Args: { p_user_id: string; p_period_start: string; p_period_end: string }
        Returns: {
          budget_id: string
          budget_name: string
          budget_amount: number
          spent_amount: number
          utilization_pct: number
        }[]
      }
      approve_receipt: {
        Args: { p_receipt_id: string; p_approver_id: string; p_approver_name: string }
        Returns: undefined
      }
      reject_receipt: {
        Args: { p_receipt_id: string; p_approver_id: string; p_approver_name: string; p_comment: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type: AccountType
      transaction_type: TransactionType
      recurring_interval: RecurringInterval
      budget_period: BudgetPeriod
    }
  }
}

// Convenience row types
export type Account = Database['public']['Tables']['accounts']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Budget = Database['public']['Tables']['budgets']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']

// Insert types
export type AccountInsert = Database['public']['Tables']['accounts']['Insert']
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
export type CategoryInsert = Database['public']['Tables']['categories']['Insert']
export type BudgetInsert = Database['public']['Tables']['budgets']['Insert']

// Update types
export type AccountUpdate = Database['public']['Tables']['accounts']['Update']
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update']
export type CategoryUpdate = Database['public']['Tables']['categories']['Update']
export type BudgetUpdate = Database['public']['Tables']['budgets']['Update']

// Employee types
export type Employee = Database['public']['Tables']['employees']['Row']
export type EmployeeInsert = Database['public']['Tables']['employees']['Insert']
export type EmployeeUpdate = Database['public']['Tables']['employees']['Update']

// Receipt + approval types
export type Receipt = Database['public']['Tables']['receipts']['Row']
export type ReceiptInsert = Database['public']['Tables']['receipts']['Insert']
export type ReceiptUpdate = Database['public']['Tables']['receipts']['Update']
export type Approval = Database['public']['Tables']['approvals']['Row']
export type ApprovalInsert = Database['public']['Tables']['approvals']['Insert']
export type DepartmentBudget = Database['public']['Tables']['department_budgets']['Row']

// View types
export type MonthlySummary = Database['public']['Views']['monthly_summary']['Row']
