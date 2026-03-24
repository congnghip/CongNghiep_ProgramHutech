
const { pool, initDB, hasPermission, getUserRoles } = require('./db');
const bcrypt = require('bcryptjs');

async function test() {
  console.log('--- BẮT ĐẦU KIỂM THỬ PHÂN CẤP KHOA-NGÀNH ---');
  
  const client = await pool.connect();
  try {
    // 1. Reset & Init DB
    await client.query('DROP TABLE IF EXISTS user_roles, role_permissions, program_versions, programs, departments, roles, users CASCADE');
    await initDB();
    console.log('1. Khởi tạo DB thành công');

    // 2. Lấy ID của các đơn vị
    const depts = await client.query('SELECT id, code, name FROM departments');
    const getID = (code) => depts.rows.find(d => d.code === code).id;
    
    const idHutech = getID('HUTECH');
    const idKhoaCNTT = getID('K.CNTT');
    const idNganhAI = getID('N.TTNT');
    const idNganhSE = getID('N.CNTT');

    // 3. Tạo tài khoản mẫu
    const hash = await bcrypt.hash('123', 10);
    
    // - Trưởng ngành AI
    const resAI = await client.query("INSERT INTO users (username, password_hash, display_name) VALUES ('truongnganh_ai', $1, 'Trưởng ngành AI') RETURNING id", [hash]);
    const uAI = resAI.rows[0].id;
    
    // - Lãnh đạo Khoa CNTT
    const resKhoa = await client.query("INSERT INTO users (username, password_hash, display_name) VALUES ('lanhdao_khoa', $1, 'Lãnh đạo Khoa CNTT') RETURNING id", [hash]);
    const uKhoa = resKhoa.rows[0].id;

    // 4. Gán vai trò
    const roleTN = (await client.query("SELECT id FROM roles WHERE code='TRUONG_NGANH'")).rows[0].id;
    const roleLD = (await client.query("SELECT id FROM roles WHERE code='LANH_DAO_KHOA'")).rows[0].id;

    await client.query("INSERT INTO user_roles (user_id, role_id, department_id) VALUES ($1, $2, $3)", [uAI, roleTN, idNganhAI]);
    await client.query("INSERT INTO user_roles (user_id, role_id, department_id) VALUES ($1, $2, $3)", [uKhoa, roleLD, idKhoaCNTT]);
    console.log('2. Gán vai trò mẫu thành công');

    // 5. Tạo CTĐT mẫu
    await client.query("INSERT INTO programs (name, code, department_id) VALUES ('CTĐT Trí tuệ nhân tạo', 'AI-01', $1)", [idNganhAI]);
    await client.query("INSERT INTO programs (name, code, department_id) VALUES ('CTĐT Kỹ thuật phần mềm', 'SE-01', $1)", [idNganhSE]);
    console.log('3. Tạo CTĐT mẫu thành công');

    // 6. Kiểm tra quyền (hasPermission)
    console.log('\n--- Kiểm tra hasPermission ---');
    
    const canAIDeleteAI = await hasPermission(uAI, 'programs.delete_draft', idNganhAI);
    console.log(`- Trưởng ngành AI có quyền xóa tại Ngành AI: ${canAIDeleteAI ? '✅' : '❌'}`);

    const canAIDeleteSE = await hasPermission(uAI, 'programs.delete_draft', idNganhSE);
    console.log(`- Trưởng ngành AI có quyền xóa tại Ngành SE: ${canAIDeleteSE ? '✅ (LỖI)' : '❌ (ĐÚNG)'}`);

    const canKhoaDeleteAI = await hasPermission(uKhoa, 'programs.delete_draft', idNganhAI);
    console.log(`- Lãnh đạo Khoa có quyền xóa tại Ngành AI (con): ${canKhoaDeleteAI ? '✅' : '❌'}`);

    const canKhoaDeleteSE = await hasPermission(uKhoa, 'programs.delete_draft', idNganhSE);
    console.log(`- Lãnh đạo Khoa có quyền xóa tại Ngành SE (con): ${canKhoaDeleteSE ? '✅' : '❌'}`);

  } catch (e) {
    console.error('LỖI:', e);
  } finally {
    client.release();
    process.exit();
  }
}

test();
