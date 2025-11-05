import { PrismaClient, ServiceStatus, Visibility } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureUser() {
  const id = 'u1';
  const full_name = 'Alice Test';
  const citizen_id = 'CITZ-ALICE-0001';
  const phone = '0900000001';
  const email = 'alice@example.com';
  const qr_code = 'qr-alice';

  const user = await prisma.user.upsert({
    where: { id },
    update: { full_name, citizen_id, phone, email, qr_code, status: 'active' },
    create: { id, full_name, citizen_id, phone, email, qr_code, status: 'active' },
  });

  // ensure wallet exists
  await prisma.wallet.upsert({
    where: { user_id: id },
    update: { status: 'active' },
    create: { user_id: id, secs: 0, status: 'active' },
  });

  return user;
}

async function main() {
  // 1) Ensure a user exists (u1)
  const user = await ensureUser();

  // 2) Pick some existing skills. If none exist, instruct to run seed first.
  const skills = await prisma.skill.findMany({ take: 2 });
  if (skills.length === 0) {
    console.error('No skills found in DB. Run `npm run prisma:seed` first to create sample skills.');
    process.exit(1);
  }

  // 3) Create a sample job (Service) and attach the skills
  const preferredStart = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow

  const service = await prisma.service.create({
    data: {
      user_id: user.id,
      title: 'Sample Job: Teach English (script)',
      description: 'Created by prisma/add-sample-job.ts — includes 2 sample skills',
      region_code: null,
      place: 'Remote',
      status: ServiceStatus.open,
      preferred_start: preferredStart,
      time: 60,
      slot: 60,
      visibility: Visibility.public,
      serviceSkills: {
        create: skills.map((s) => ({ skill: { connect: { id: s.id } } })),
      },
    },
    include: {
      serviceSkills: { include: { skill: true } },
    },
  });

  console.log('Created job (service) id:', service.id);
  console.log('Attached skills:', service.serviceSkills.map((ss) => ss.skill.name).join(', '));
}

main()
  .catch((e) => {
    console.error('Error creating sample job:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
