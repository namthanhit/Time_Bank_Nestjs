import { PrismaClient, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding user data...');

  // Hash password for seeding (use a simple one for testing)
  const hashedPassword = await argon2.hash('admin');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { phone: '01234567890' },
    update: {},
    create: {
      id: 'admin01',
      full_name: 'Admin',
      phone: '01234567890',
      email: 'admin02@example.com',
      status: UserStatus.active,
      detail: {
        create: {
          birth_date: new Date('1990-01-01'),
          gender: 'male',
          description: 'Administrator of the system',
          street: '123 Admin Street, Hanoi',
        },
      },
      auth: {
        create: {
          password: hashedPassword,
          phone_verified_at: new Date(),
          email_verified_at: new Date(),
        },
      },
    },
  });

  // Create regular users
  const users: Array<{
    id: string;
    full_name: string;
    phone: string;
    email: string;
    status: UserStatus;
    created_at: Date;
  }> = [];
  const statuses = [UserStatus.active, UserStatus.pending, UserStatus.suspended, UserStatus.banned];
  
  for (let i = 1; i <= 50; i++) {
    const firstNames = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vo', 'Dinh', 'Bui', 'Do', 'Ho', 'Ngo', 'Duong', 'Ly', 'Tran', 'Pham'];
    const lastNames = ['Van A', 'Thi B', 'Van C', 'Thi D', 'Van E', 'Thi F', 'Van G', 'Thi H', 'Van I', 'Thi J', 'Van K', 'Thi L', 'Van M', 'Thi N', 'Van O'];
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${firstName} ${lastName}`;
    const phone = `09${Math.floor(Math.random() * 90000000) + 10000000}`;
    const email = `${fullName.toLowerCase().replace(/\s+/g, '')}${i}@example.com`;
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    // Random date within the last 2 years
    const createdDate = new Date();
    createdDate.setTime(createdDate.getTime() - Math.random() * 2 * 365 * 24 * 60 * 60 * 1000);
    
    users.push({
      id: `user_${Date.now()}_${i}`,
      full_name: fullName,
      phone: phone,
      email: email,
      status: status,
      created_at: createdDate,
    });
  }

  for (const userData of users) {
    await prisma.user.upsert({
      where: { phone: userData.phone },
      update: {},
      create: {
        ...userData,
        detail: {
          create: {
            birth_date: new Date(`199${Math.floor(Math.random() * 9)}-0${Math.floor(Math.random() * 9) + 1}-0${Math.floor(Math.random() * 9) + 1}`),
            gender: Math.random() > 0.5 ? 'male' : 'female',
            description: `Bio for ${userData.full_name}`,
            street: 'Vietnam',
          },
        },
        auth: {
          create: {
            password: hashedPassword,
            phone_verified_at: new Date(),
          },
        },
      },
    });
  }

  console.log('User seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });