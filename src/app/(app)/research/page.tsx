import { Plus, BookOpen, FileText } from 'lucide-react'

export default function ResearchPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Research Hub</h1>
          <p className="text-slate-500">Organize your research notes and reading list</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Research Notes</h3>
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No notes yet</p>
            <p className="text-sm mb-4">Capture insights from annual reports, earnings calls, and more</p>
            <button className="btn-primary">
              <Plus className="w-4 h-4 inline mr-2" />
              New Note
            </button>
          </div>
        </div>

        {/* Reading List */}
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Reading List</h3>
          <div className="text-center py-12 text-slate-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Reading list empty</p>
            <p className="text-sm mb-4">Track articles, reports, and investor letters</p>
            <button className="btn-outline">
              <Plus className="w-4 h-4 inline mr-2" />
              Add Item
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
