import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding region data...');

  const raw = fs.readFileSync('prisma/data/regions.json', 'utf-8');
  const provinces = JSON.parse(raw);

  const vietnam = await prisma.region.upsert({
    where: { id: 'VN' },
    update: {},
    create: {
      id: 'VN',
      name: 'Việt Nam',
      codename: 'viet_nam',
      division_type: 'quốc gia',
      type: 'country',
    },
  });

  for (const province of provinces) {
    try {
      const createdProvince = await prisma.region.create({
        data: {
          name: province.name,
          code: province.code,
          codename: province.codename,
          division_type: province.division_type,
          phone_code: province.phone_code,
          type: 'province',
          parent_id: vietnam.id,
        },
      });

      for (const district of province.districts || []) {
        const createdDistrict = await prisma.region.create({
          data: {
            name: district.name,
            code: district.code,
            codename: district.codename,
            division_type: district.division_type,
            short_codename: district.short_codename,
            type: 'district',
            parent_id: createdProvince.id,
          },
        });

        // 5️⃣ Import cấp phường / xã
        for (const ward of district.wards || []) {
          await prisma.region.create({
            data: {
              name: ward.name,
              code: ward.code,
              codename: ward.codename,
              division_type: ward.division_type,
              short_codename: ward.short_codename,
              type: 'ward',
              parent_id: createdDistrict.id,
            },
          });
        }
      }

      console.log(`Imported province: ${province.name}`);
    } catch (error) {
      console.error(`Failed to import province ${province.name}:`, error);
    }
  }

  console.log('Finished seeding all regions!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
