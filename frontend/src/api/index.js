import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

// Interceptors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// Cong trinh
export const getCongTrinh = () => api.get('/cong-trinh')
export const createCongTrinh = (data) => api.post('/cong-trinh/', data)
export const updateCongTrinh = (id, data) => api.put(`/cong-trinh/${id}`, data)
export const deleteCongTrinh = (id) => api.delete(`/cong-trinh/${id}`)
export const updateCongTrinhStatus = (id, trang_thai) => api.put(`/cong-trinh/${id}/trang-thai`, { trang_thai })

// Phieu
export const getPhieuList = (params) => api.get('/phieu/', { params })
export const getChiTietPhieu = (id) => api.get(`/phieu/${id}/chi-tiet`)
export const createPhieu = (data) => api.post('/phieu/', data)
export const deletePhieu = (id, userEmail = '') => api.delete(`/phieu/${id}`, { params: { user_email: userEmail } })
export const updatePhieu = (id, data) => api.put(`/phieu/${id}`, data)
export const getLichSuGiaoDich = (params) => api.get('/phieu/lich-su', { params })

// Hang hoa
export const getHangHoa = (params) => api.get('/hang-hoa/', { params })
export const createHangHoa = (data) => api.post('/hang-hoa/', data)
export const updateHangHoa = (ma, data) => api.put(`/hang-hoa/${ma}`, data)
export const deleteHangHoa = (ma) => api.delete(`/hang-hoa/${ma}`)

// Ton kho
export const getTonKho = (params) => api.get('/ton-kho/', { params })
export const themHangTonKho = (data) => api.post('/ton-kho/them-hang', data)
export const dieuChinhTonKho = (data) => api.post('/ton-kho/dieu-chinh', data)
export const xoaHangTonKho = (params) => api.delete('/ton-kho/xoa-hang', { params })

// Bao cao
export const getBaoCaoTongHop = (params) => api.get('/bao-cao/tong-hop', { params })
export const getBieuDo = (params) => api.get('/bao-cao/bieu-do', { params })

// Nhat ky hoat dong
export const getNhatKy = (params) => api.get('/nhat-ky/', { params })
export const logActivity = (data) => api.post('/nhat-ky/log', data)

// AI
export const docPhieu = (formData) => api.post('/ai/doc-phieu', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 120000
})
export const docPhieuMulti = (formData) => api.post('/ai/doc-phieu-multi', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 120000
})
export const splitPdf = (formData) => api.post('/files/split-pdf', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  responseType: 'blob',
  timeout: 60000
})

// AI Fuzzy Match
export const matchItems = (data) => api.post('/ai/match-items', data, { timeout: 30000 })
export const confirmMatch = (data) => api.post('/ai/confirm-match', data, { timeout: 30000 })
