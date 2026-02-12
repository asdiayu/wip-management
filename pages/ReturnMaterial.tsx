
import React from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import SearchableSelect from '../components/ui/SearchableSelect';
import { ReplyIcon } from '../constants';
import { useReturnMaterial } from '../hooks/useReturnMaterial';

const ReturnMaterial: React.FC = () => {
    const {
        activeTab, handleTabChange, locations, materialOptions,
        date, setDate, selectedMaterial, setSelectedMaterial,
        locationId, setLocationId, quantity, setQuantity, reason, setReason,
        isLoading, message, availableStock, selectedMaterialUnit,
        handleSubmit
    } = useReturnMaterial();

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg text-orange-600 dark:text-orange-400">
                    <ReplyIcon className="h-8 w-8" />
                </div>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Manajemen Retur</h1>
            </div>

            <div className="bg-white dark:bg-slate-800/50 shadow-md rounded-xl overflow-hidden max-w-3xl mx-auto">
                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                    <button onClick={() => handleTabChange('customer')} className={`flex-1 py-4 text-center font-medium transition-colors ${activeTab === 'customer' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-b-2 border-green-500' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        Retur Dari Customer (Masuk)
                    </button>
                    <button onClick={() => handleTabChange('supplier')} className={`flex-1 py-4 text-center font-medium transition-colors ${activeTab === 'supplier' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-b-2 border-red-500' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        Retur Ke Supplier (Keluar)
                    </button>
                </div>

                <div className="p-6 sm:p-8">
                    <div className={`mb-6 p-4 rounded-lg border ${activeTab === 'customer' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                        <p className="text-sm">{activeTab === 'customer' ? "Barang dikembalikan oleh pelanggan/proyek. Stok akan BERTAMBAH." : "Barang dikembalikan ke supplier (rusak/reject). Stok akan BERKURANG."}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input id="date" label="Tanggal Retur" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                        <SearchableSelect id="material" label="Pilih Barang" options={materialOptions} value={selectedMaterial} onChange={setSelectedMaterial} placeholder="Cari barang..." />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <Select id="location" label={activeTab === 'customer' ? "Simpan ke Lokasi" : "Ambil dari Lokasi"} value={locationId} onChange={e => setLocationId(e.target.value)} required>
                                    <option value="" disabled>-- Pilih Lokasi --</option>
                                    {locations.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
                                </Select>
                                {activeTab === 'supplier' && locationId && selectedMaterial && (<p className="mt-1 text-xs text-slate-500">Stok Tersedia: <b>{availableStock} {selectedMaterialUnit}</b></p>)}
                            </div>
                            <Input id="qty" label={`Jumlah Retur (${selectedMaterialUnit})`} type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.00" required />
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Alasan Retur</label>
                            <textarea className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-primary-500 focus:border-primary-500 sm:text-sm" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder={activeTab === 'customer' ? "Contoh: Sisa proyek, salah kirim" : "Contoh: Barang cacat, kemasan rusak"} required></textarea>
                        </div>

                        {message && (<div className={`p-4 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{message.text}</div>)}

                        <div className="flex justify-end"><Button type="submit" isLoading={isLoading} className={`w-full md:w-auto ${activeTab === 'customer' ? '!bg-green-600 hover:!bg-green-700' : '!bg-red-600 hover:!bg-red-700'}`}>Simpan Transaksi Retur</Button></div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ReturnMaterial;
