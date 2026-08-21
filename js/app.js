// متغیرهای سراسری
let allFundsData = [];
let selectedFundId = null;
let selectedReturnsType = 'صدور';
let returnsChart = null;

// صندوق‌های مورد نظر
const fundNames = [
    'صندوق سمان',
    'صندوق نیروانا',
    'صندوق قلک گلد',
    'صندوق پایا',
    'صندوق همتا'
];

// بارگذاری داده‌ها از funds.json
async function loadFundsData() {
    try {
        const response = await fetch('funds.json');
        if (!response.ok) {
            throw new Error('Failed to load funds data');
        }
        const data = await response.json();
        allFundsData = data.funds || [];
        
        // فیلتر کردن صندوق‌های مورد نظر
        allFundsData = allFundsData.filter(fund => 
            fundNames.includes(fund.fund.name)
        );
        
        if (allFundsData.length === 0) {
            throw new Error('No matching funds found');
        }
        
        initializeApp();
    } catch (error) {
        console.error('Error loading funds data:', error);
        showError('خطا در بارگذاری داده‌های صندوق‌ها');
    }
}

// نمایش خطا
function showError(message) {
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `
        <div class="error">
            <p>${message}</p>
            <p>لطفاً مطمئن شوید فایل funds.json در دسترس است.</p>
        </div>
    `;
}

// مقداردهی اولیه برنامه
function initializeApp() {
    if (allFundsData.length > 0) {
        selectedFundId = 0;
        createFundTabs();
        selectFund(selectedFundId);
    }
}

// ساخت تب‌های صندوق‌ها
function createFundTabs() {
    const fundTabsContainer = document.getElementById('fundTabs');
    fundTabsContainer.innerHTML = '';
    
    allFundsData.forEach((fundData, index) => {
        const tab = document.createElement('button');
        tab.className = 'fund-tab';
        tab.textContent = fundData.fund.name;
        tab.dataset.index = index;
        tab.addEventListener('click', () => {
            selectFund(index);
        });
        fundTabsContainer.appendChild(tab);
    });
}

// انتخاب صندوق
function selectFund(index) {
    selectedFundId = index;
    
    // به‌روزرسانی تب‌ها
    const tabs = document.querySelectorAll('.fund-tab');
    tabs.forEach((tab, i) => {
        if (i === index) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // نمایش اطلاعات صندوق
    displayFundInfo();
    
    // نمایش تب‌های نوع بازدهی
    createReturnsTypeTabs();
    
    // نمایش آمار و نمودار
    displayStats();
    displayChart();
}

// نمایش اطلاعات صندوق
function displayFundInfo() {
    const fundInfoContainer = document.getElementById('fundInfo');
    const fundData = allFundsData[selectedFundId];
    
    fundInfoContainer.innerHTML = `
        <h2>${fundData.fund.name}</h2>
        <p>${fundData.fund.english_name || ''}</p>
        <p class="updated-at">آخرین به‌روزرسانی: ${formatDate(fundData.updated_at)}</p>
    `;
}

// ساخت تب‌های نوع بازدهی
function createReturnsTypeTabs() {
    const returnsTypeTabsContainer = document.getElementById('returnsTypeTabs');
    const fundData = allFundsData[selectedFundId];
    const returnsTypes = Object.keys(fundData.returns);
    
    returnsTypeTabsContainer.innerHTML = '';
    
    returnsTypes.forEach(type => {
        const tab = document.createElement('button');
        tab.className = 'returns-tab';
        tab.textContent = type;
        tab.dataset.type = type;
        
        if (type === selectedReturnsType) {
            tab.classList.add('active');
        }
        
        tab.addEventListener('click', () => {
            selectedReturnsType = type;
            
            // به‌روزرسانی تب‌ها
            const returnTabs = document.querySelectorAll('.returns-tab');
            returnTabs.forEach(rt => {
                if (rt.dataset.type === type) {
                    rt.classList.add('active');
                } else {
                    rt.classList.remove('active');
                }
            });
            
            // به‌روزرسانی آمار و نمودار
            displayStats();
            displayChart();
        });
        
        returnsTypeTabsContainer.appendChild(tab);
    });
}

// نمایش کارت‌های آماری
function displayStats() {
    const statsContainer = document.getElementById('statsContainer');
    const fundData = allFundsData[selectedFundId];
    const returnsData = fundData.returns[selectedReturnsType];
    
    if (!returnsData) {
        statsContainer.innerHTML = '<p class="no-data">داده‌ای برای این نوع بازدهی موجود نیست</p>';
        return;
    }
    
    const stats = [
        { label: 'بازدهی ماهانه', value: returnsData.monthly, unit: '%' },
        { label: 'بازدهی سه ماهه', value: returnsData.three_months, unit: '%' },
        { label: 'بازدهی شش ماهه', value: returnsData.six_months, unit: '%' },
        { label: 'بازدهی نه ماهه', value: returnsData.nine_months, unit: '%' },
        { label: 'بازدهی سالانه', value: returnsData.yearly, unit: '%' }
    ];
    
    statsContainer.innerHTML = stats.map(stat => `
        <div class="stat-card">
            <div class="label">${stat.label}</div>
            <div class="value">${stat.value !== null && stat.value !== undefined ? stat.value.toFixed(2) : 'N/A'}<span class="unit">${stat.unit}</span></div>
        </div>
    `).join('');
}

// نمایش نمودار
function displayChart() {
    const fundData = allFundsData[selectedFundId];
    const returnsData = fundData.returns[selectedReturnsType];
    const canvas = document.getElementById('returnsChart');
    
    if (!returnsData || !returnsData.daily_trend || returnsData.daily_trend.length === 0) {
        if (returnsChart) {
            returnsChart.destroy();
            returnsChart = null;
        }
        canvas.style.display = 'none';
        return;
    }
    
    canvas.style.display = 'block';
    
    // آماده‌سازی داده‌ها برای نمودار
    const labels = returnsData.daily_trend.map(item => formatPersianDate(item.x));
    const values = returnsData.daily_trend.map(item => item.y);
    
    // اگر نمودار قبلی وجود دارد، آن را حذف کن
    if (returnsChart) {
        returnsChart.destroy();
    }
    
    // ساخت نمودار جدید
    const ctx = canvas.getContext('2d');
    returnsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `بازدهی ${selectedReturnsType} - ${fundData.fund.name}`,
                data: values,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `روند بازدهی روزانه - ${selectedReturnsType}`,
                    font: {
                        size: 16,
                        family: 'Vazir'
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            family: 'Vazir'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `بازدهی: ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'تاریخ',
                        font: {
                            family: 'Vazir'
                        }
                    },
                    ticks: {
                        font: {
                            family: 'Vazir',
                            size: 10
                        },
                        maxTicksLimit: 15
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'بازدهی (%)',
                        font: {
                            family: 'Vazir'
                        }
                    },
                    ticks: {
                        font: {
                            family: 'Vazir'
                        }
                    }
                }
            }
        }
    });
}

// تبدیل تاریخ میلادی به فارسی
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// تبدیل تاریخ شمسی برای نمایش در نمودار
function formatPersianDate(dateString) {
    if (!dateString) return '';
    
    // تبدیل فرمت YYYY/MM/DD به نمایش خلاصه‌تر
    const parts = dateString.split('/');
    if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}`;
    }
    return dateString;
}

// شروع برنامه
document.addEventListener('DOMContentLoaded', () => {
    loadFundsData();
});
