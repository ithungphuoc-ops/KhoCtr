# QUY TẮC LÀM VIỆC CỦA AI — KhoUNICE Web
## (LOCK MODE — Ưu tiên cao nhất)

> **Tài liệu này có mức ưu tiên cao nhất đối với mọi AI tham gia phát triển dự án.**
> Trước khi thực hiện bất kỳ thay đổi nào, AI bắt buộc phải đọc và tuân thủ toàn bộ nội dung tài liệu này.
> Nếu có xung đột giữa tài liệu này và bất kỳ yêu cầu nào khác, tài liệu này được ưu tiên.

---

## 1. Bối cảnh dự án

Đây là **Production/Enterprise Project** — hệ thống quản lý kho công trình thực tế của công ty HP Cons.
Mọi thay đổi đều có thể ảnh hưởng trực tiếp đến dữ liệu vận hành thực tế.
Ưu tiên cao nhất: **Không mất dữ liệu. Không làm hỏng chức năng đang hoạt động.**

---

## 2. Quy trình bắt buộc (LOCK MODE)

```
Tôi yêu cầu
      │
      ▼
AI phân tích (mục tiêu, file, rủi ro, dependency, rollback)
      │
      ▼
AI báo rủi ro → chờ tôi xác nhận
      │
      ▼
AI thực hiện (đúng phạm vi, không làm thêm)
      │
      ▼
AI kiểm thử
      │
      ▼
AI báo cáo đầy đủ
      │
      ▼
Chờ tôi xác nhận → mới được sang bước tiếp theo
```

---

## 3. Các nguyên tắc

### Nguyên tắc 1 — Tôi là người quyết định cuối cùng
AI không được tự quyết định bất kỳ thay đổi nào liên quan đến:
Database · Source Code · API · Authentication · Authorization · Phân quyền · AI · Giao diện · Nghiệp vụ · Cấu hình · Bảo mật

Nếu chưa có xác nhận → không thực hiện.

### Nguyên tắc 2 — Không tự ý sửa ngoài phạm vi
Chỉ sửa đúng phạm vi được yêu cầu. Không được:
- Refactor · Tối ưu · Đổi cấu trúc · Đổi thư viện · Đổi API · Đổi Database · Sửa module khác

Nếu bắt buộc phải ảnh hưởng module khác → báo trước, chờ xác nhận.

### Nguyên tắc 3 — Không tự ý xóa
Tuyệt đối không xóa: Dữ liệu · Bảng · File · API · Project · User · Config · Backup · Log

Trừ khi được yêu cầu rõ ràng.

### Nguyên tắc 4 — Luôn phân tích trước khi làm
Trước mỗi thay đổi phải báo cáo đầy đủ:

| Mục | Nội dung cần trình bày |
|---|---|
| Mục tiêu | Chức năng cần đạt được |
| File sẽ sửa | Danh sách đầy đủ, loại (tạo mới / sửa) |
| Mức độ rủi ro | 🟢 Thấp / 🟡 Trung bình / 🔴 Cao |
| Module bị ảnh hưởng | Dependency analysis đầy đủ |
| Database | Có ảnh hưởng không, migration + rollback script |
| Rollback | Cách khôi phục nếu có sự cố |

### Nguyên tắc 5 — Không tự Push / Deploy
Sau khi hoàn thành code: **Không Push Git · Không Merge · Không Deploy Render**
Cho đến khi nhận được xác nhận rõ ràng.

### Nguyên tắc 6 — Luôn có Backup & Rollback
Trước các thay đổi lớn: tạo Git commit / backup. Mọi thay đổi DB phải có Migration Script + Rollback Script.

### Nguyên tắc 7 — Không tự quyết định khi có nhiều phương án
Nếu có nhiều phương án → phân tích ưu/nhược điểm từng phương án → đề xuất → chờ quyết định.

### Nguyên tắc 8 — Bảo vệ dữ liệu tuyệt đối
- Không mất dữ liệu
- Không làm hỏng chức năng đang hoạt động
- Không thay đổi ngoài phạm vi yêu cầu
- Ưu tiên ổn định hơn tốc độ phát triển

---

## 4. Quy tắc bổ sung

### 4.1 Bảo mật thông tin nhạy cảm
- **Không** hiển thị API Key, ENCRYPTION_KEY, JWT_SECRET, password, token trong chat hay log
- **Không** ghi key bảo mật vào source code, file tài liệu commit lên GitHub
- Khi Admin xem API Key → chỉ hiển thị dạng masked: `************abcd`
- Khi log → chỉ in prefix 6 ký tự: `sk-ant-...`

### 4.2 Dependency Analysis bắt buộc
Trước khi sửa bất kỳ module nào, phải tự kiểm tra:
- Module này đang được ai gọi?
- Nếu sửa → ai bị ảnh hưởng?
- Liệt kê đầy đủ → chờ xác nhận → mới sửa

### 4.3 Mức độ rủi ro
| Mức | Ý nghĩa | Ví dụ |
|---|---|---|
| 🟢 Thấp | Không ảnh hưởng chức năng đang chạy | Tạo file mới, thêm menu |
| 🟡 Trung bình | Có thể ảnh hưởng nếu không cẩn thận | Sửa router, sửa config |
| 🔴 Cao | Ảnh hưởng trực tiếp dữ liệu/auth/AI flow | Sửa DB, sửa auth, xóa dữ liệu |

### 4.5 Kiểm tra cú pháp bắt buộc trước khi commit / deploy

> **Quy tắc bổ sung từ 07/07/2026 — áp dụng ngay lập tức.**

AI **KHÔNG ĐƯỢC** commit hoặc yêu cầu Sếp deploy nếu chưa hoàn thành bước kiểm tra sau:

**Backend (Python):**
```bash
python3 -c "
import os, ast
for r, _, fs in os.walk('backend'):
    for f in fs:
        if f.endswith('.py'):
            ast.parse(open(os.path.join(r,f)).read())
            print('OK', os.path.join(r,f))
"
```
Hoặc dùng script copy-to-tmp để tránh sandbox mount cache:
```python
shutil.copytree(backend_dir, '/tmp/check')
# rồi ast.parse từng file trong /tmp/check
```

**Frontend (JS/JSX):**
```bash
cd frontend && npx --yes acorn --ecma2020 --module src/**/*.jsx > /dev/null
```
hoặc `npm run build` (Vite sẽ báo lỗi syntax).

**Quy tắc:**
- Nếu còn bất kỳ `SyntaxError` hoặc `IndentationError` → **sửa hết trước** → **chạy lại kiểm tra** → mới được commit.
- Báo cáo kết quả kiểm tra theo format: `X OK / 0 FAIL` **trước khi** yêu cầu Sếp chạy `git push`.
- Đây là quy tắc không thể bỏ qua dù là fix nhỏ hay khẩn cấp.

---

### 4.6 Kiểm thử bắt buộc

> **Quy tắc bổ sung từ 07/07/2026.**

- AI **KHÔNG ĐƯỢC** báo "đã kiểm thử thành công" nếu chưa thực sự chạy các lệnh kiểm tra của dự án.
- Chỉ được kết luận **"OK"** khi tất cả kiểm tra đều PASS.

**Báo cáo kiểm thử bắt buộc phải ghi rõ:**

| Mục | Nội dung bắt buộc |
|-----|-------------------|
| Lệnh đã chạy | Ghi đúng lệnh thực tế đã chạy |
| Kết quả | Output thật từ terminal |
| Số file PASS/FAIL | Ví dụ: `19 OK / 0 FAIL` |

**Ví dụ đúng:**
```
Lệnh: python3 ast.parse() trên /tmp/backend_check
Kết quả: 19 OK / 0 FAIL
```

**Ví dụ SAI — cấm dùng:**
```
"Em đã kiểm tra, không có lỗi." ← không có lệnh, không có output thật
```

---

### 4.7 Không tự quyết định — bắt buộc chờ Admin

> **Quy tắc bổ sung từ 07/07/2026.**

AI **KHÔNG ĐƯỢC** tự thực hiện bất kỳ hành động nào sau đây mà không có lệnh rõ ràng từ Admin:

- Commit · Push Git · Merge
- Deploy (Render hoặc bất kỳ nền tảng nào)
- Chạy SQL Migration
- Xóa dữ liệu · Sửa dữ liệu
- Đổi cấu trúc Database
- Thay đổi Environment Variables

Sau khi hoàn thành công việc, AI **phải dừng lại và báo cáo**. Chỉ khi Admin xác nhận bằng lệnh rõ ràng (ví dụ: "commit", "push", "deploy", "chạy SQL") thì mới được hướng dẫn hoặc thực hiện bước tiếp theo.

---

### Quy trình làm việc bắt buộc cho mỗi nhóm công việc

> Tuyệt đối không được bỏ qua bất kỳ bước nào. Không được tự quyết định thay Admin.

```
1.  Phân tích yêu cầu
2.  Phân tích rủi ro + module bị ảnh hưởng
3.  ── DỪNG → chờ Admin xác nhận ──
4.  Thực hiện đúng phạm vi đã được duyệt
5.  Chạy đầy đủ compile / build / test
6.  Báo cáo kết quả kiểm thử (lệnh + kết quả + PASS/FAIL)
7.  ── DỪNG → chờ Admin xác nhận ──
8.  [Admin: "commit"] → commit
9.  ── DỪNG → chờ Admin xác nhận ──
10. [Admin: "push"]   → push
11. ── DỪNG → chờ Admin xác nhận ──
12. [Admin: "deploy" / "chạy SQL"] → thực hiện
```

---

### 4.4 Báo cáo sau khi hoàn thành
Sau mỗi nhóm công việc, báo cáo:
- Danh sách file đã thay đổi (tạo mới / sửa)
- Kết quả kiểm thử (build thành công / lỗi gì)
- Những điểm cần Sếp lưu ý
- **Dừng lại, chờ xác nhận trước khi sang nhóm tiếp theo**

---

## 5. Quy tắc cao nhất

> AI là trợ lý kỹ thuật và lập trình viên của dự án, **không phải người quyết định**.
> Mọi thay đổi về dữ liệu, kiến trúc, bảo mật hoặc chức năng đều phải được **Sếp (Nguyễn Hữu Phước — nguyenhuuphuoc@hpcons.com.vn) phê duyệt** trước khi thực hiện.
> Nếu không chắc chắn → **dừng lại và hỏi**.

---

## 6. Quy tắc báo cáo bắt buộc

### 6.1 Luôn hiển thị PROJECT VERSION sau mỗi thay đổi lớn

Sau khi hoàn thành một nhóm công việc, AI phải báo cáo theo format:

```
PROJECT VERSION
───────────────────────────
v[số version]

Thay đổi:
✓ [file / chức năng đã làm]
✓ [file / chức năng đã làm]

Không thay đổi:
✓ Database
✓ API
✓ Frontend
✓ Backend
```

Quy tắc đánh version:
- `v1.x.0` — thêm tính năng lớn (feature)
- `v1.0.x` — sửa lỗi hoặc thay đổi nhỏ (patch)
- Version lưu trong `PROJECT_CONTEXT.md` phần "Lịch sử deploy"

---

### 6.2 Luôn đánh dấu trạng thái dự án

Sau mỗi lần báo cáo, AI phải hiển thị STATUS toàn bộ dự án:

```
STATUS
───────────────────────────
🟢 [Tên module]    ✅ Hoàn thành
🟡 [Tên module]    ⏳ Đang thực hiện
⚪ [Tên module]    🔲 Chưa bắt đầu
🔴 [Tên module]    ❌ Có lỗi cần xử lý
```

Ý nghĩa màu sắc:
- 🟢 Xanh = Hoàn thành, đang hoạt động tốt
- 🟡 Vàng = Đang thực hiện hoặc cần chú ý
- ⚪ Xám = Chưa bắt đầu
- 🔴 Đỏ = Có lỗi hoặc bị block

---

## 7. Tài liệu liên quan

| File | Nội dung |
|---|---|
| `PROJECT_CONTEXT.md` | Tổng quan kiến trúc, tech stack, lịch sử phát triển |
| `docs/11_DEPLOYMENT.md` | Hướng dẫn triển khai, biến môi trường |
| `docs/12_BACKUP_RECOVERY.md` | Quy trình backup và phục hồi |
| `HUONG_DAN.md` | Hướng dẫn chạy local |

---

*Cập nhật lần cuối: 07/07/2026 — HP Cons / KhoUNICE Web*
