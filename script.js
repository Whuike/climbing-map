// ==================== Firebase 配置 ====================
const firebaseConfig = {
  apiKey: "AIzaSyBf9uVDKHZM2nHz0tAYYujZr_zVfHCkX70",
  authDomain: "climbing-map-2f729.firebaseapp.com",
  projectId: "climbing-map-2f729",
  storageBucket: "climbing-map-2f729.firebasestorage.app",
  messagingSenderId: "530023297017",
  appId: "1:530023297017:web:4275a92db3fb645f605728"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==================== 地图初始化（国内访问更快） ====================
let map = L.map('map').setView([35.0, 105.0], 5);

// 使用高德地图瓦片（中国大陆速度明显更快）
L.tileLayer('https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', {
    attribution: '&copy; 高德地图',
    maxZoom: 18
}).addTo(map);

let currentLatLng = null;

// ==================== 加载路线（加强版 + 过滤已下架） ====================
function loadRoutes() {
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    db.collection("routes").get().then(snapshot => {
        if (snapshot.empty) {
            console.log("目前还没有路线");
            return;
        }

        snapshot.forEach(doc => {
            const r = doc.data();
            
            // 新增：过滤已被管理员下架的路线
            if (r.status === "removed") return;

            const marker = L.marker([r.lat, r.lng]).addTo(map);
            
            marker.bindPopup(`
                <b>${r.name}</b><br>
                难度：${r.difficulty}<br>
                类型：${r.routeType || '未分类'}<br>
                区域：${r.area}<br>
                <small>by ${r.author}</small><br><br>
                <button onclick="showRouteDetail('${doc.id}')">查看详细信息</button>
            `);
        });
    }).catch(err => console.error("加载失败:", err));
}

// ==================== 登录/注册（友好中文提示） ====================
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');
const authModal = document.getElementById('authModal');
const authActionBtn = document.getElementById('authActionBtn');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const modalTitle = document.getElementById('modalTitle');
const toggleMode = document.getElementById('toggleMode');
const toggleHint = document.getElementById('toggleHint');

let isLoginMode = true;

loginBtn.addEventListener('click', () => { authModal.style.display = 'flex'; switchToLogin(); });
document.querySelector('.close').addEventListener('click', () => authModal.style.display = 'none');

loginTab.addEventListener('click', switchToLogin);
registerTab.addEventListener('click', switchToRegister);

function switchToLogin() {
    isLoginMode = true;
    loginTab.classList.add('active'); registerTab.classList.remove('active');
    modalTitle.textContent = '登录账号';
    authActionBtn.textContent = '登录';
    toggleHint.textContent = '还没有账号？';
    toggleMode.textContent = '去注册';
}

function switchToRegister() {
    isLoginMode = false;
    registerTab.classList.add('active'); loginTab.classList.remove('active');
    modalTitle.textContent = '注册新账号';
    authActionBtn.textContent = '注册';
    toggleHint.textContent = '已有账号？';
    toggleMode.textContent = '去登录';
}

toggleMode.addEventListener('click', () => isLoginMode ? switchToRegister() : switchToLogin());

authActionBtn.addEventListener('click', () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) return alert('❌ 邮箱和密码不能为空');

    if (isLoginMode) {
        auth.signInWithEmailAndPassword(email, password)
            .then(() => { authModal.style.display = 'none'; alert('✅ 登录成功！欢迎回来～'); })
            .catch(err => {
                if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-login-credentials') {
                    alert('❌ 邮箱或密码错误！\n\n请检查：\n1. 是否已经注册过账号\n2. 密码是否输入正确');
                } else if (err.code === 'auth/invalid-email') {
                    alert('❌ 邮箱格式不正确');
                } else {
                    alert('登录失败：' + err.message);
                }
            });
    } else {
        auth.createUserWithEmailAndPassword(email, password)
            .then(() => { authModal.style.display = 'none'; alert('🎉 注册成功！欢迎加入攀岩社区！'); })
            .catch(err => {
                if (err.code === 'auth/email-already-in-use') {
                    alert('❌ 这个邮箱已经被注册过了！\n\n请切换到「登录」');
                } else if (err.code === 'auth/weak-password') {
                    alert('❌ 密码太简单！\n\n请至少6位，最好包含字母和数字');
                } else {
                    alert('注册失败：' + err.message);
                }
            });
    }
});

auth.onAuthStateChanged(user => {
    if (user && !user.isAnonymous) {
        userInfo.textContent = `欢迎，${user.email.split('@')[0]}`;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
    } else {
        userInfo.textContent = '欢迎游客';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
    }
});

logoutBtn.addEventListener('click', () => auth.signOut());

// ==================== 地点搜索功能 ====================
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');

if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (!query) {
            alert('请输入地点名称，例如：阳朔月亮山');
            return;
        }

        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lng = parseFloat(data[0].lon);
                    
                    currentLatLng = { lat: lat, lng: lng };
                    map.setView([lat, lng], 15);
                    
                    document.getElementById('selectedLocation').textContent = 
                        `已选位置：${lat.toFixed(4)}, ${lng.toFixed(4)} (${data[0].display_name})`;
                    
                    alert(`✅ 已定位到：${data[0].display_name}`);
                } else {
                    alert('未找到该地点，请尝试更精确的名称或手动点击地图');
                }
            })
            .catch(() => alert('搜索失败，请检查网络或尝试手动选点'));
    });
}

// ==================== 上传新路线 ====================
const uploadModal = document.getElementById('uploadModal');

document.getElementById('addRouteBtn').addEventListener('click', () => {
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
        alert('请先登录才能上传路线！');
        return;
    }
    uploadModal.style.display = 'flex';
    currentLatLng = null;
    document.getElementById('selectedLocation').textContent = '已选位置：未选择';
});

document.getElementById('pickLocationBtn').addEventListener('click', () => {
    uploadModal.style.display = 'none';
    alert('请在地图上点击一次选择位置');
    map.once('click', e => {
        currentLatLng = e.latlng;
        document.getElementById('selectedLocation').textContent = `已选位置：${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
        uploadModal.style.display = 'flex';
    });
});

document.getElementById('submitRouteBtn').addEventListener('click', async () => {
    if (!currentLatLng) return alert('请先选择路线位置！');

    const files = document.getElementById('routeImages').files;
    if (files.length === 0) {
        return alert('❌ 必须上传至少一张路线照片 / Topo图！');
    }

    const data = {
        name: document.getElementById('routeName').value,
        difficulty: document.getElementById('difficulty').value,
        routeType: document.getElementById('routeType').value,
        area: document.getElementById('area').value,
        firstAscent: document.getElementById('firstAscent').value,
        quickdraws: document.getElementById('quickdraws').value,
        length: document.getElementById('length').value,
        heightDiff: document.getElementById('heightDiff').value,
        beta: document.getElementById('beta').value,
        crux: document.getElementById('crux').value,
        safety: document.getElementById('safety').value,
        extraTips: document.getElementById('extraTips').value,
        lat: currentLatLng.lat,
        lng: currentLatLng.lng,
        author: auth.currentUser.email.split('@')[0],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.name || !data.difficulty || !data.routeType || !data.area) {
        return alert('请填写所有带 * 的必填项');
    }

    try {
        // 改进版：显示更明显的提示 + 进度
        alert(`正在上传 ${files.length} 张图片，请不要关闭网页...`);

        let imageUrls = [];
        let successCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const storageRef = firebase.storage().ref('route_images/' + Date.now() + '_' + file.name);
            
            await storageRef.put(file);
            const downloadURL = await storageRef.getDownloadURL();
            imageUrls.push(downloadURL);
            successCount++;
            
            console.log(`✅ 已上传 ${successCount}/${files.length} 张图片`);
        }

        // 保存到 Firestore
        data.images = imageUrls;

        await db.collection("routes").add(data);
        
        alert(`🎉 路线和 ${successCount} 张图片全部上传成功！`);
        uploadModal.style.display = 'none';
        document.getElementById('routeImages').value = ''; // 清空文件选择
        loadRoutes();
        
    } catch (err) {
        console.error(err);
        alert('❌ 上传失败：' + err.message + '\n\n可能原因：网络不稳定或图片太大');
    }
});

// 关闭弹窗
document.querySelectorAll('.close-upload').forEach(btn => {
    btn.addEventListener('click', () => uploadModal.style.display = 'none');
});

// ==================== 详细查看弹窗 + 删除功能（只修改这部分） ====================
const detailModal = document.getElementById('detailModal');
const detailContent = document.getElementById('detailContent');

window.showRouteDetail = function(routeId) {
    db.collection("routes").doc(routeId).get().then(doc => {
        if (!doc.exists) return alert("路线不存在");

        const r = doc.data();
        const isOwner = auth.currentUser && r.author === auth.currentUser.email.split('@')[0];

        let html = `
            <h2>${r.name}</h2>
            <p><strong>难度：</strong>${r.difficulty}　<strong>类型：</strong>${r.routeType || '未分类'}</p>
            <p><strong>区域：</strong>${r.area}</p>
            <p><strong>定线时间：</strong>${r.firstAscent || '未知'}</p>
            <p><strong>长度：</strong>${r.length || '未知'}米　<strong>高度差：</strong>${r.heightDiff || '未知'}米</p>
            <p><strong>安全注意事项：</strong>${r.safety || '暂无'}</p>
            <p><strong>小Tips：</strong>${r.extraTips || '暂无'}</p>
        `;

        if (r.images && r.images.length > 0) {
            html += `<div style="margin:15px 0;"><strong>照片 / Topo图：</strong><br>`;
            r.images.forEach(url => {
                html += `<img src="${url}" style="max-width:100%; margin:8px 0; border-radius:8px;">`;
            });
            html += `</div>`;
        }

        if (isOwner) {
            html += `<button onclick="deleteRoute('${routeId}')" style="background:#e74c3c; color:white; padding:10px 20px; border:none; border-radius:6px; cursor:pointer; margin-top:15px;">🗑️ 删除这条路线</button>`;
        }

        detailContent.innerHTML = html;
        detailModal.style.display = 'flex';

    }).catch(err => alert("加载失败：" + err.message));
};

// 删除路线
window.deleteRoute = function(routeId) {
    if (!confirm('确定要删除这条路线吗？此操作不可恢复！')) return;

    db.collection("routes").doc(routeId).delete().then(() => {
        alert('✅ 路线已删除');
        detailModal.style.display = 'none';
        loadRoutes();
    }).catch(err => alert('删除失败：' + err.message));
};

// 关闭详细弹窗
document.querySelector('.close-detail').addEventListener('click', () => {
    detailModal.style.display = 'none';
});

// ==================== 打分和评论功能（只添加这部分） ====================

// 加载评分和评论
function loadRatingAndComments(routeId) {
    // 加载平均评分
    db.collection("routes").doc(routeId).collection("ratings").get().then(snapshot => {
        let total = 0, count = 0;
        snapshot.forEach(doc => {
            total += doc.data().score;
            count++;
        });
        const avg = count > 0 ? (total / count).toFixed(1) : 0;
        document.getElementById('starRating').innerHTML = `平均评分：${avg} 分 (${count}人)`;
    });

    // 加载评论
    const commentsList = document.getElementById('commentsList');
    commentsList.innerHTML = '';
    db.collection("routes").doc(routeId).collection("comments").orderBy("createdAt", "desc").get().then(snapshot => {
        if (snapshot.empty) {
            commentsList.innerHTML = '<p>还没有评论，赶快来分享你的经验吧！</p>';
            return;
        }
        snapshot.forEach(doc => {
            const c = doc.data();
            const div = document.createElement('div');
            div.style.marginBottom = '12px';
            div.style.padding = '8px';
            div.style.borderBottom = '1px solid #eee';
            div.innerHTML = `<strong>${c.author}</strong>：<br>${c.text}`;
            commentsList.appendChild(div);
        });
    });
}

// ==================== 打分和评论功能（按要求优化） ====================

let currentRouteId = null;

// 加载评分和评论
function loadRatingAndComments(routeId) {
    currentRouteId = routeId;

    // ==================== 1. 平均评分（一个人只能评一次） ====================
    const ratingsRef = db.collection("routes").doc(routeId).collection("ratings");
    ratingsRef.get().then(snapshot => {
        let total = 0, count = 0;
        let hasRated = false;

        snapshot.forEach(doc => {
            total += parseFloat(doc.data().score) || 0;
            count++;
            if (auth.currentUser && doc.id === auth.currentUser.uid) hasRated = true;
        });

        const avg = count > 0 ? (total / count).toFixed(1) : "暂无";
        document.getElementById('starRating').innerHTML = `
            ⭐ 平均评分：${avg} 分 (${count}人)<br>
            ${hasRated ? '<small style="color:#27ae60">✓ 你已打分</small>' : '<small>点击下方打分</small>'}
        `;
    });

    // ==================== 2. 评论区（支持回复） ====================
    const commentsList = document.getElementById('commentsList');
    commentsList.innerHTML = '';

    db.collection("routes").doc(routeId).collection("comments")
        .orderBy("createdAt", "desc").get().then(snapshot => {
            if (snapshot.empty) {
                commentsList.innerHTML = '<p>还没有评论，赶快来分享你的攀登经验吧！</p>';
                return;
            }

            const commentsMap = {};
            snapshot.forEach(doc => {
                const c = doc.data();
                c.id = doc.id;
                commentsMap[c.id] = c;
            });

            // 显示主评论
            Object.values(commentsMap).filter(c => !c.parentId).forEach(mainComment => {
                const div = document.createElement('div');
                div.style.marginBottom = '15px';
                div.style.padding = '10px';
                div.style.borderLeft = '4px solid #3498db';
                div.innerHTML = `
                    <strong>${mainComment.author}</strong> <small>${mainComment.createdAt ? new Date(mainComment.createdAt.toDate()).toLocaleString() : ''}</small><br>
                    ${mainComment.text}
                    <button onclick="replyToComment('${mainComment.id}')" style="margin-left:10px; font-size:12px; color:#3498db;">回复</button>
                `;
                commentsList.appendChild(div);

                // 显示回复
                Object.values(commentsMap).filter(c => c.parentId === mainComment.id).forEach(reply => {
                    const replyDiv = document.createElement('div');
                    replyDiv.style.marginLeft = '30px';
                    replyDiv.style.marginTop = '8px';
                    replyDiv.style.paddingLeft = '12px';
                    replyDiv.style.borderLeft = '3px solid #95a5a6';
                    replyDiv.innerHTML = `
                        <strong>${reply.author}</strong> <small>${reply.createdAt ? new Date(reply.createdAt.toDate()).toLocaleString() : ''}</small><br>
                        ${reply.text}
                    `;
                    commentsList.appendChild(replyDiv);
                });
            });
        });
}

// 打分（一个人只能一次）
document.getElementById('starRating').addEventListener('click', () => {
    if (!auth.currentUser) return alert('请先登录才能打分！');
    if (!currentRouteId) return;

    const score = parseInt(prompt('请为这条路线打分（1-5分）：', '5'));
    if (isNaN(score) || score < 1 || score > 5) return alert('请输入1-5之间的整数');

    // 检查是否已打分
    db.collection("routes").doc(currentRouteId).collection("ratings").doc(auth.currentUser.uid).get().then(doc => {
        if (doc.exists) {
            alert('你已经为这条路线打过分了！');
            return;
        }

        db.collection("routes").doc(currentRouteId).collection("ratings").doc(auth.currentUser.uid).set({
            score: score,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            alert('✅ 打分成功！');
            loadRatingAndComments(currentRouteId);
        });
    });
});

// 回复评论
window.replyToComment = function(parentId) {
    if (!auth.currentUser) return alert('请先登录才能回复！');
    
    const text = prompt('回复这条评论：');
    if (!text || text.trim() === '') return;

    db.collection("routes").doc(currentRouteId).collection("comments").add({
        author: auth.currentUser.email.split('@')[0],
        text: text.trim(),
        parentId: parentId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        loadRatingAndComments(currentRouteId);
    });
};

// 发表主评论
document.getElementById('submitCommentBtn').addEventListener('click', () => {
    if (!auth.currentUser) return alert('请先登录才能评论！');
    if (!currentRouteId) return;

    const text = document.getElementById('commentInput').value.trim();
    if (!text) return alert('评论内容不能为空');

    db.collection("routes").doc(currentRouteId).collection("comments").add({
        author: auth.currentUser.email.split('@')[0],
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        document.getElementById('commentInput').value = '';
        loadRatingAndComments(currentRouteId);
        alert('✅ 评论发表成功！');
    });
});

// 增强 showRouteDetail
const originalShowRouteDetail = window.showRouteDetail;
window.showRouteDetail = function(routeId) {
    originalShowRouteDetail(routeId);
    setTimeout(() => loadRatingAndComments(routeId), 600);
};

// ==================== 管理员下架功能（最小化版） ====================

const ADMIN_EMAIL = "guanliyuan@huike.com";

window.adminDeleteRoute = function(routeId) {
    if (!confirm('【管理员】确定要下架这条路线吗？')) return;

    db.collection("routes").doc(routeId).update({
        status: "removed",
        removedBy: auth.currentUser.email,
        removedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert('✅ 已下架');
        detailModal.style.display = 'none';
        loadRoutes();
    }).catch(err => alert('下架失败：' + err.message));
};

// 只在管理员登录时，在详情弹窗里添加按钮（不覆盖原有showRouteDetail）
setTimeout(() => {
    const originalShow = window.showRouteDetail;
    window.showRouteDetail = function(routeId) {
        originalShow(routeId);
        
        setTimeout(() => {
            if (auth.currentUser && auth.currentUser.email === ADMIN_EMAIL) {
                const btn = document.createElement('button');
                btn.textContent = '🚫 管理员下架这条路线';
                btn.style.cssText = 'background:#e74c3c;color:white;padding:12px 20px;border:none;border-radius:6px;cursor:pointer;margin:15px 0;width:100%;';
                btn.onclick = () => adminDeleteRoute(routeId);
                detailContent.appendChild(btn);
            }
        }, 800);
    };
}, 1000);