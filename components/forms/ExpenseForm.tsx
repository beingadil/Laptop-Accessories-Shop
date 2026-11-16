'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { FormPageShell } from '@/components/forms/FormPageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateInput } from '@/lib/format';

interface ExpenseCategory {
  id: string;
  name: string;
}

export interface ExpenseFormInitialData {
  id?: string;
  title: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
  description: string;
  notes: string;
}

export function ExpenseForm({ initialData }: { initialData?: ExpenseFormInitialData }) {
  const router = useRouter();
  const isEditing = Boolean(initialData?.id);

  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);
  const [title, setTitle] = React.useState(initialData?.title || '');
  const [categoryId, setCategoryId] = React.useState(initialData?.categoryId || '');
  const [amount, setAmount] = React.useState<string>(
    initialData?.amount ? String(initialData.amount) : ''
  );
  const [expenseDate, setExpenseDate] = React.useState(
    initialData?.expenseDate || formatDateInput(new Date())
  );
  const [description, setDescription] = React.useState(initialData?.description || '');
  const [notes, setNotes] = React.useState(initialData?.notes || '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // Small modal for adding custom expense category
  const [catModalOpen, setCatModalOpen] = React.useState(false);
  const [newCatName, setNewCatName] = React.useState('');
  const [creatingCat, setCreatingCat] = React.useState(false);

  const loadCategories = React.useCallback(async () => {
    try {
      const res = await fetch('/api/expense-categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.items || []);
      }
    } catch {
      // Ignore
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      void loadCategories();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCategories]);

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (newCatName.trim().length < 2) {
      toast.error('Category name must be at least 2 characters.');
      return;
    }
    setCreatingCat(true);
    try {
      const res = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim(), status: 'ACTIVE' }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Could not create category.');
        return;
      }
      toast.success(`Category "${json.name}" created.`);
      await loadCategories();
      setCategoryId(json.id);
      setNewCatName('');
      setCatModalOpen(false);
    } catch {
      toast.error('Network error creating expense category.');
    } finally {
      setCreatingCat(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const parsedAmount = Number(amount);
    if (!title.trim() || title.trim().length < 2) {
      setError('Expense title must be at least 2 characters.');
      return;
    }
    if (!categoryId) {
      setError('Please select an expense category.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than 0 PKR.');
      return;
    }
    if (!expenseDate) {
      setError('Expense date is required.');
      return;
    }

    setSaving(true);
    try {
      const url = isEditing ? `/api/expenses/${initialData!.id}` : '/api/expenses';
      const method = isEditing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          categoryId,
          amount: parsedAmount,
          expenseDate,
          description: description.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to save expense.');
        return;
      }
      toast.success(isEditing ? 'Expense updated.' : 'Expense recorded.');
      router.push('/expenses');
      router.refresh();
    } catch {
      setError('Network error while saving expense.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <FormPageShell
        title={isEditing ? 'Edit Expense' : 'Record Shop Expense'}
        subtitle="Track operational shop costs such as rent, utilities, salaries, and repairs."
        backHref="/expenses"
        backLabel="Back to Expenses"
        submitLabel={isEditing ? 'Update Expense' : 'Save Expense'}
        saving={saving}
        formId="expense-form"
      >
        <form id="expense-form" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Expense Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="expense-title">
                  Expense Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="expense-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Monthly Shop Rent, Electricity Bill, Packaging Tape"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="expense-category">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => setCatModalOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3 w-3" />
                    Add Category
                  </button>
                </div>
                <select
                  id="expense-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expense-amount">
                  Amount (PKR) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="expense-amount"
                  type="number"
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expense-date">
                  Expense Date <span className="text-red-500">*</span>
                </Label>
                <DatePicker
                  id="expense-date"
                  value={expenseDate}
                  onChange={setExpenseDate}
                  ariaLabel="Expense Date"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expense-description">Description</Label>
                <Input
                  id="expense-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief detail (e.g. LESCO meter reading #204)"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="expense-notes">Internal Notes</Label>
                <Textarea
                  id="expense-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional reference notes..."
                />
              </div>
            </CardContent>
          </Card>
        </form>
      </FormPageShell>

      <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Expense Category</DialogTitle>
            <DialogDescription>
              Create a new expense category for tracking shop overheads.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-expense-cat">
                Category Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new-expense-cat"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Courier & Freight"
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCatModalOpen(false)}
                disabled={creatingCat}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creatingCat}>
                {creatingCat ? 'Saving...' : 'Create Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
