import { PrismaClient, LedgerDirection, TransferStatus, WalletStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureUserWithWallet(params: {
  id: string;
  full_name: string;
  citizen_id: string;
  phone: string;
  email: string;
  qr_code: string;
  secs?: number; // số giây nạp sẵn vào ví
}) {
  const { id, full_name, citizen_id, phone, email, qr_code, secs = 0 } = params;

  const user = await prisma.user.upsert({
    where: { id },
    update: {
      full_name,
      citizen_id,
      phone,
      email,
      qr_code,
    },
    create: {
      id,
      full_name,
      citizen_id,
      phone,
      email,
      qr_code,
    },
  });

  await prisma.wallet.upsert({
    where: { user_id: id },
    update: { secs },
    create: {
      user_id: id,
      secs,
      status: WalletStatus.active,
    },
  });

  return user;
}

/**
 * Tạo một transfer hoàn chỉnh giữa 2 ví (giống logic trong service):
 * - tạo transfer pending
 * - cập nhật số dư (secs)
 * - ghi ledger đôi (minutes)
 * - mark completed
 */
async function seedTransferMinutes(fromUserId: string, toUserId: string, minutes: number, note?: string) {
  const secs = minutes * 60;

  // Lấy ví nguồn/đích
  const [fromWallet, toWallet] = await Promise.all([
    prisma.wallet.findUniqueOrThrow({ where: { user_id: fromUserId } }),
    prisma.wallet.findUniqueOrThrow({ where: { user_id: toUserId } }),
  ]);

  if (fromWallet.status !== 'active' || toWallet.status !== 'active') {
    throw new Error('Wallet not active');
  }
  if (fromWallet.secs < secs) {
    throw new Error('Insufficient balance in seed');
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1) pending transfer
    const transfer = await tx.transfer.create({
      data: {
        from_wallet_id: fromWallet.id,
        to_wallet_id: toWallet.id,
        secs,
        status: TransferStatus.pending,
        note: note?.slice(0, 200),
      },
    });

    // 2) update balances
    await tx.wallet.update({
      where: { id: fromWallet.id },
      data: { secs: { decrement: secs } },
    });
    await tx.wallet.update({
      where: { id: toWallet.id },
      data: { secs: { increment: secs } },
    });

    // 3) ledger (đơn vị minutes)
    await tx.ledgerEntry.createMany({
      data: [
        {
          wallet_id: fromWallet.id,
          direction: LedgerDirection.debit,
          minutes,
          ref_type: 'transfer',
          ref_id: transfer.id,
          memo: note?.slice(0, 200),
        },
        {
          wallet_id: toWallet.id,
          direction: LedgerDirection.credit,
          minutes,
          ref_type: 'transfer',
          ref_id: transfer.id,
          memo: note?.slice(0, 200),
        },
      ],
    });

    // 4) complete
    const completed = await tx.transfer.update({
      where: { id: transfer.id },
      data: { status: TransferStatus.completed, completed_at: new Date() },
    });

    return completed;
  });

  return result;
}

async function main() {
  // 1) Tạo user + ví
  await ensureUserWithWallet({
    id: 'u1',
    full_name: 'Alice Test',
    citizen_id: 'CITZ-ALICE-0001',
    phone: '0900000001',
    email: 'alice@example.com',
    qr_code: 'qr-alice',
    secs: 3 * 3600, // 3 giờ
  });

  await ensureUserWithWallet({
    id: 'u2',
    full_name: 'Bob Test',
    citizen_id: 'CITZ-BOB-0002',
    phone: '0900000002',
    email: 'bob@example.com',
    qr_code: 'qr-bob',
    secs: 0,
  });

  // 2) Tạo một giao dịch mẫu 30 phút u1 -> u2
  const tx = await seedTransferMinutes('u1', 'u2', 30, 'seed transfer 30m');

  // 3) Log kết quả
  const w1 = await prisma.wallet.findUniqueOrThrow({ where: { user_id: 'u1' } });
  const w2 = await prisma.wallet.findUniqueOrThrow({ where: { user_id: 'u2' } });

  console.log('Seed done.');
  console.table([
    { user: 'u1', secs: w1.secs, minutes: Math.floor(w1.secs / 60), hours: (w1.secs / 3600).toFixed(2) },
    { user: 'u2', secs: w2.secs, minutes: Math.floor(w2.secs / 60), hours: (w2.secs / 3600).toFixed(2) },
  ]);
  console.log('Sample transfer id:', tx.id);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
