import { PrismaClient, ServiceStatus, Visibility } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding service data...');

  // Clean up existing services
  await prisma.service.deleteMany({});

  // First, ensure some skills exist
  const skills = [
    { name: 'Việc nhà', slug: 'viec-nha' },
    { name: 'Nội trợ', slug: 'noi-tro' },
    { name: 'Sửa chữa', slug: 'sua-chua' },
    { name: 'Giáo dục', slug: 'giao-duc' },
    { name: 'Thiết kế', slug: 'thiet-ke' },
    { name: 'Công nghệ', slug: 'cong-nghe' },
    { name: 'Y tế', slug: 'y-te' },
    { name: 'Tư vấn', slug: 'tu-van' },
    { name: 'Vận chuyển', slug: 'van-chuyen' },
    { name: 'Chăm sóc', slug: 'cham-soc' },
    { name: 'Lập trình', slug: 'lap-trinh' },
    { name: 'Âm nhạc', slug: 'am-nhac' },
    { name: 'Nấu ăn', slug: 'nau-an' },
    { name: 'Làm đẹp', slug: 'lam-dep' },
    { name: 'Thể thao', slug: 'the-thao' },
    { name: 'Nông nghiệp', slug: 'nong-nghiep' },
  ];

  for (const skillData of skills) {
    await prisma.skill.upsert({
      where: { slug: skillData.slug },
      update: {},
      create: skillData,
    });
  }

  // Get existing users
  const users = await prisma.user.findMany({
    where: { status: 'active' },
  });

  if (users.length === 0) {
    console.log('No active users found. Please run seeduser.ts first.');
    return;
  }

  // Create services
  const services: Array<{
    user_id: string;
    title: string;
    description: string;
    region_code: string;
    place: string;
    preferred_start: Date;
    time: number;
    slot: number;
    visibility: Visibility;
    status: ServiceStatus;
    skills: string[];
    created_at: Date;
  }> = [];
  const statuses = [ServiceStatus.open, ServiceStatus.matched, ServiceStatus.completed, ServiceStatus.pending, ServiceStatus.cancelled, ServiceStatus.expired, ServiceStatus.banned];
  const regions = [
    { code: 'HN', place: 'Hà Nội' },
    { code: 'HCM', place: 'TP. Hồ Chí Minh' },
    { code: 'DN', place: 'Đà Nẵng' },
    { code: 'HP', place: 'Hải Phòng' },
    { code: 'CT', place: 'Cần Thơ' },
  ];

  const serviceTemplates = [
    { title: 'Dịch vụ sửa chữa điện tử', desc: 'Sửa chữa các thiết bị điện tử, điện thoại, máy tính', skills: ['Sửa chữa', 'Công nghệ'] },
    { title: 'Dạy kèm tiếng Anh', desc: 'Dạy kèm tiếng Anh cho học sinh cấp 2, cấp 3', skills: ['Giáo dục'] },
    { title: 'Thiết kế đồ họa', desc: 'Thiết kế logo, banner, poster chuyên nghiệp', skills: ['Thiết kế', 'Công nghệ'] },
    { title: 'Giúp việc nhà theo giờ', desc: 'Dọn dẹp nhà cửa, nấu ăn, giặt là', skills: ['Việc nhà', 'Nội trợ', 'Chăm sóc'] },
    { title: 'Tư vấn marketing online', desc: 'Tư vấn chiến lược marketing, quảng cáo Facebook, Google', skills: ['Tư vấn', 'Công nghệ'] },
    { title: 'Chăm sóc người cao tuổi', desc: 'Chăm sóc, đi lại, ăn uống cho người cao tuổi', skills: ['Chăm sóc', 'Y tế'] },
    { title: 'Vận chuyển hàng hóa nội thành', desc: 'Dịch vụ vận chuyển hàng hóa, đồ đạc trong nội thành', skills: ['Vận chuyển'] },
    { title: 'Lập trình web frontend', desc: 'Phát triển website responsive với React, Vue.js', skills: ['Công nghệ', 'Lập trình'] },
    { title: 'Dạy kèm toán học', desc: 'Gia sư toán từ lớp 6 đến lớp 12', skills: ['Giáo dục'] },
    { title: 'Sửa chữa ống nước', desc: 'Thay thế, sửa chữa hệ thống ống nước trong nhà', skills: ['Sửa chữa'] },
    { title: 'Thiết kế nội thất', desc: 'Tư vấn và thiết kế nội thất phòng khách, phòng ngủ', skills: ['Thiết kế'] },
    { title: 'Dịch vụ kế toán thuế', desc: 'Lập báo cáo thuế, quyết toán thuế hàng năm', skills: ['Tư vấn'] },
    { title: 'Chăm sóc trẻ em', desc: 'Trông trẻ, dạy học tại nhà cho trẻ 3-10 tuổi', skills: ['Chăm sóc', 'Giáo dục'] },
    { title: 'Vận chuyển xe máy', desc: 'Chuyển nhà, vận chuyển đồ đạc bằng xe máy', skills: ['Vận chuyển'] },
    { title: 'Dạy nhạc cụ piano', desc: 'Dạy piano cho người mới bắt đầu và nâng cao', skills: ['Giáo dục', 'Âm nhạc'] },
    { title: 'Lắp đặt camera an ninh', desc: 'Tư vấn và lắp đặt hệ thống camera giám sát', skills: ['Công nghệ', 'Sửa chữa'] },
    { title: 'Tư vấn dinh dưỡng', desc: 'Tư vấn chế độ ăn uống lành mạnh, giảm cân', skills: ['Tư vấn', 'Y tế'] },
    { title: 'Dọn dẹp văn phòng', desc: 'Dịch vụ dọn dẹp văn phòng, tòa nhà', skills: ['Việc nhà', 'Nội trợ'] },
    { title: 'Sửa chữa điều hòa', desc: 'Bảo dưỡng, sửa chữa máy lạnh, điều hòa', skills: ['Sửa chữa'] },
    { title: 'Dạy kèm hóa học', desc: 'Gia sư hóa học cho học sinh THPT', skills: ['Giáo dục'] },
    { title: 'Thiết kế website', desc: 'Thiết kế và phát triển website doanh nghiệp', skills: ['Thiết kế', 'Công nghệ', 'Lập trình'] },
    { title: 'Vận chuyển hàng nặng', desc: 'Vận chuyển đồ đạc, hàng hóa cồng kềnh', skills: ['Vận chuyển'] },
    { title: 'Nấu ăn gia đình', desc: 'Dịch vụ nấu ăn hàng ngày cho gia đình', skills: ['Nấu ăn', 'Việc nhà'] },
    { title: 'Massage thư giãn', desc: 'Dịch vụ massage, spa tại nhà', skills: ['Chăm sóc', 'Làm đẹp'] },
    { title: 'Tư vấn đầu tư', desc: 'Tư vấn đầu tư chứng khoán, bất động sản', skills: ['Tư vấn'] },
  ];

  for (let i = 1; i <= 100; i++) {
    const template = serviceTemplates[Math.floor(Math.random() * serviceTemplates.length)];
    const region = regions[Math.floor(Math.random() * regions.length)];
    const user = users[Math.floor(Math.random() * users.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    // Random date within the last year
    const createdDate = new Date();
    createdDate.setTime(createdDate.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000);

    // Random preferred start date (future)
    const preferredStart = new Date();
    preferredStart.setTime(preferredStart.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000);

    services.push({
      user_id: user.id,
      title: `${template.title} ${i}`,
      description: template.desc,
      region_code: region.code,
      place: region.place,
      preferred_start: preferredStart,
      time: Math.floor(Math.random() * 480) + 30, // 30-510 minutes
      slot: Math.floor(Math.random() * 240) + 15, // 15-255 minutes
      visibility: Math.random() > 0.7 ? Visibility.friends : Visibility.public,
      status: status,
      skills: template.skills,
      created_at: createdDate,
    });
  }

  for (const serviceData of services) {
    const skillRecords = await prisma.skill.findMany({
      where: {
        name: {
          in: serviceData.skills,
        },
      },
    });

    const service = await prisma.service.create({
      data: {
        user_id: serviceData.user_id,
        title: serviceData.title,
        description: serviceData.description,
        region_code: serviceData.region_code,
        place: serviceData.place,
        preferred_start: serviceData.preferred_start,
        time: serviceData.time,
        slot: serviceData.slot,
        visibility: serviceData.visibility,
        status: serviceData.status,
        created_at: serviceData.created_at,
        serviceSkills: {
          create: skillRecords.map(skill => ({
            skill_id: skill.id,
          })),
        },
      },
    });

    console.log(`Created service: ${service.title}`);
  }

  console.log('Service seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });