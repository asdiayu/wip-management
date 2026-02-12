
import React from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import SearchableSelect from '../components/ui/SearchableSelect';
import { SwitchHorizontalIcon } from '../constants';
import { useStockTransfer } from '../hooks/useStockTransfer';

const StockTransfer: React.FC = () => {
    const {
        locations, stockSourceLocations, materialOptions,
        date, setDate, selectedMaterial, setSelectedMaterial,
        sourceLocation, setSourceLocation, destLocation, setDestLocation,
        quantity, setQuantity, notes, setNotes,
        isLoading, message, availableStock, selectedMaterialUnit,
        handleSubmit
    } = useStockTransfer();

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <SwitchHorizontalIcon className="h-8 w-8" />
                </div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Mutasi Lokasi (Transfer)</h1>
            </div>

            <div className="bg-white dark:bg-slate-800/50 p-6 sm:p-8 rounded-xl shadow-md max-w-3xl mx-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input id="date" label="Tanggal Mutasi" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

                    <SearchableSelect
                        id="material" label="Pilih Barang" options={materialOptions} value={selectedMaterial}
                        onChange={(val) => { setSelectedMaterial(val); setSourceLocation(''); }}
                        placeholder="Cari barang yang akan dipindah..."
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div>
                             <Select id="source" label="Lokasi Asal (Sumber)" value={sourceLocation} onChange={e => setSourceLocation(e.target.value)} required disabled={!selectedMaterial}>
                                <option value="" disabled>-- Pilih Asal --</option>
                                {stockSourceLocations.map(l => (<option key={l.location_id} value={l.location_id}>{l.location_name} (Stok: {l.stock_quantity})</option>))}
                            </Select>
                            {sourceLocation && (<p className="mt-1 text-xs text-slate-500">Tersedia: <span className="font-bold text-slate-700 dark:text-slate-200">{availableStock} {selectedMaterialUnit}</span></p>)}
                        </div>

                        <div className="flex flex-col justify-center items-center md:pt-6">
                            <SwitchHorizontalIcon className="h-6 w-6 text-slate-400 rotate-90 md:rotate-0" />
                        </div>

                        <div>
                            <Select id="dest" label="Lokasi Tujuan" value={destLocation} onChange={e => setDestLocation(e.target.value)} required disabled={!selectedMaterial}>
                                <option value="" disabled>-- Pilih Tujuan --</option>
                                {locations.filter(l => l.id !== sourceLocation).map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input id="qty" label={`Jumlah Dipindah (${selectedMaterialUnit})`} type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.00" required />
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan</label>
                            <textarea className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-primary-500 focus:border-primary-500 sm:text-sm" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alasan pemindahan..."></textarea>
                        </div>
                    </div>

                    {message && (<div className={`p-4 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>)}

                    <div className="flex justify-end"><Button type="submit" isLoading={isLoading} className="w-full md:w-auto">Proses Mutasi</Button></div>
                </form>
            </div>
        </div>
    );
};

export default StockTransfer;
