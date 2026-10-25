# Order Template

Chuẩn hoá signal từ Telegram Bot → TCE Engine → Binance.

## Recommended format

```text
XAUUSD BUY | Entry 4582 | SL 4567 | TP 4588
```

## Structured format

```text
ORDER SIGNAL

Symbol: XAUUSD
Side: BUY
Entry: 4582
SL: 4567
TP: 4588
```

## Rules

- `Symbol`: mã giao dịch, ví dụ `XAUUSD`, `BTCUSDT`.
- `Side`: chỉ `BUY` hoặc `SELL`.
- `Entry`: **một giá duy nhất**.
- `SL`: một mức stop loss bắt buộc.
- `TP`: **TP1 duy nhất** được engine sử dụng.
- Không truyền nhiều TP; nếu signal có TP1/TP2/TP3 thì chỉ normalize và sử dụng TP1.
- `Quantity` không bắt buộc trong Telegram signal; engine lấy quantity mặc định từ Binance Engine config trên FE/DB.
- Khi Entry được khớp và position tồn tại, engine đảm bảo protection theo thứ tự **SL trước → verify SL → TP**.
- Nếu position đã tồn tại nhưng thiếu SL hoặc TP, engine tự bổ sung protection còn thiếu.
- Không mở thêm Entry cho cùng `symbol` khi đã có position/order active.
- Client order ID phải deterministic theo signal ID để retry không tạo duplicate order.

## Example: BUY

```text
XAUUSD BUY | Entry 4582 | SL 4567 | TP 4588
```

## Example: SELL

```text
XAUUSD SELL | Entry 4582 | SL 4597 | TP 4576
```

## Do not use

```text
XAUUSD BUY 4582_4580
TP 4588
TP 4592
TP 4596
SL 4567
```

Signal trên có nhiều Entry/TP và không phù hợp với contract hiện tại. Hãy normalize thành **1 Entry + 1 TP + 1 SL** trước khi đưa vào engine.
