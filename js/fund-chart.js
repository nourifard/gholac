'use strict';

// ==================== State ====================
let allFunds = [];
let currentFundIndex = 0;
let currentType = null; // 'صدور' | 'ابطال' | 'آماری'
let currentRange = '1y';
let customStart = null;
let customEnd = null;
let chartInstance = null;

// ==================== DOM Elements ====================
const fundSelect = document.getElementById('fundSelect');
const typeButtons = document.getElementById('typeButtons');
const rangeButtons = document.getElementById('rangeButtons');
const customDateInputs = document.getElementById('customDateInputs');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const applyCustomRangeBtn = document.getElementById('applyCustomRange');
const chartEl = document.getElementById('chart');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');

// Info elements
const fundNameEl = document.getElementById('fundName');
const typeBadgeEl = document.getElementById('typeBadge');
const periodReturnEl = document.getElementById('periodReturn');
const startDateInfoEl = document.getElementById('startDateInfo');
const endDateInfoEl = document.getElementById('endDateInfo');
const updatedAtEl = document.getElementById('updatedAt');
const statsGridEl = document.getElementById('statsGrid');

// ==================== Date Utilities (Persian/Shamsi) ====================
function parseShamsi(str) {
    if (!str || typeof str !== 'string') return { year: 0, month: 0, day: 0 };
    const parts = str.split('/').map(Number);
    return { year: parts[0] || 0, month: parts[1] || 0, day: parts[2] || 0 };
}

function compareShamsi(a, b) {
    if (a.year !== b.year) return a.year < b.year ? -1 : 1;
    if (a.month !== b.month) return a.month < b.month ? -1 : 1;
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    return 0;
}

function shamsiToKey(str) {
     p = parseShamsi(str);
    return p.year * 10000 + p.month * 100 + p.day;
}

function subtractMonthsShamsi(dateStr, months) {
    let { year, month, day } = parseShamsi(dateStr);
    month -= months;
    while (month <= 0) {
        month += 12;
        year--;
    }
    // Persian month lengths
     leapYears = [1, 5, 9, 13, 17, 22, 26, 30];
     cycleIndex = ((year - 1300) % 33 + 33) % 33;
     isLeap = leapYears.includes(cycleIndex);
    let maxDay;
    if (month <= 6) maxDay = 31;
    else if (month <= 11) maxDay = 30;
    else maxDay = isLeap ? 30 : 29;
    
    if (day > maxDay) day = maxDay;
    return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

function findClosestDate(trendData, targetDateStr) {
    if (!trendData || trendData.length === 0) return null;
     targetKey = shamsiToKey(targetDateStr);
    let closest = trendData[0];
    let minDiff = Infinity;
    for ( item of trendData) {
         diff = Math.abs(shamsiToKey(item.x) - targetKey);
        if (diff < minDiff) {
            minDiff = diff;
            closest = item;
        }
    }
    return closest;
}

// Convert Persian digits to English
function toEnglishDigits(str) {
    return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

// ==================== Fetch Data ====================
async function loadFunds() {
    console.log('Loading funds data...');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';
    
    try {
         res = await fetch('./funds.json', { cache: 'no-cache' });
        console.log('Fetch response status:', res.status);
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
         data = await res.json();
        console.log('Data loaded:', data);
        
        if (!data || !Array.isArray(data.funds) || data.funds.length === 0) {
            throw new Error('داده‌ای یافت نشد');
        }
        
        allFunds = data.funds.filter(f => f && f.fund && f.returns);
        
        if (allFunds.length === 0) {
            throw new Error('هیچ صندوق معتبری یافت نشد');
        }
        
        initControls();
        renderAll();
        
        if (loadingEl) loadingEl.style.display = 'none';
        console.log('Chart rendered successfully');
        
    } catch (err) {
        console.error('Error loading funds:', err);
        if (errorEl) {
            errorEl.textContent = 'خطا در بارگذاری funds.json: ' + err.message;
            errorEl.style.display = 'block';
        }
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

// ==================== Initialize Controls ====================
function initControls() {
    console.log('Initializing controls...');
    
    // Populate fund select
    if (fundSelect) {
        fundSelect.innerHTML = '';
        allFunds.forEach((fundData, idx) => {
             opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = fundData.fund.name;
            fundSelect.appendChild(opt);
        });
        
        fundSelect.addEventListener('change', () => {
            currentFundIndex = parseInt(fundSelect.value);
            currentType = null; // Reset type
            renderAll();
        });
    }
    
    // Range buttons
    if (rangeButtons) {
        rangeButtons.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                 range = btn.dataset.range;
                console.log('Range button clicked:', range);
                setRange(range);
            });
        });
    }
    
    // Apply custom range button
    if (applyCustomRangeBtn) {
        applyCustomRangeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Apply custom range clicked');
            applyCustomRange();
        });
    }
    
    // Enter key support
    if (startDateInput) {
        startDateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyCustomRange();
        });
    }
    if (endDateInput) {
        endDateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyCustomRange();
        });
    }
}

// ==================== Range Management ====================
function setRange(range) {
    console.log('Setting range to:', range);
    currentRange = range;
    
    // Update active state on range buttons
    if (rangeButtons) {
        rangeButtons.querySelectorAll('.btn').forEach(btn => {
            if (btn.dataset.range === range) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    // Show/hide custom date inputs
    if (range === 'custom') {
        if (customDateInputs) {
            customDateInputs.style.display = 'flex';
            customDateInputs.style.flexWrap = 'wrap';
            customDateInputs.style.gap = '0.5rem';
            customDateInputs.style.alignItems = 'center';
        }
        // Don't render yet, wait for user to input dates
        return;
    }
    
    if (customDateInputs) {
        customDateInputs.style.display = 'none';
    }
    
    // Reset custom dates when not in custom mode
    customStart = null;
    customEnd = null;
    
    // Re-render chart with new range
    renderAll();
}

function applyCustomRange() {
    console.log('Applying custom range...');
    
    if (!startDateInput || !endDateInput) {
        alert('عناصر تاریخ یافت نشدند');
        return;
    }
    
    let startStr = startDateInput.value.trim();
    let endStr = endDateInput.value.trim();
    
    console.log('Raw dates - Start:', startStr, 'End:', endStr);
    
    if (!startStr || !endStr) {
        alert('لطفاً هر دو تاریخ را وارد کنید');
        return;
    }
    
    // Convert Persian digits to English
    startStr = toEnglishDigits(startStr);
    endStr = toEnglishDigits(endStr);
    
    console.log('Converted dates - Start:', startStr, 'End:', endStr);
    
    // Validate format
     pattern = /^\d{4}\/\d{2}\/\d{2}$/;
    if (!pattern.test(startStr) || !pattern.test(endStr)) {
        alert('فرمت تاریخ باید YYYY/MM/DD باشد\nمثال: 1404/05/28');
        return;
    }
    
    if (shamsiToKey(startStr) > shamsiToKey(endStr)) {
        alert('تاریخ شروع باید قبل از تاریخ پایان باشد');
        return;
    }
    
    customStart = startStr;
    customEnd = endStr;
    currentRange = 'custom';
    
    console.log('Custom range set:', customStart, 'to', customEnd);
    
    // Re-render chart
    renderAll();
}

// ==================== Render All ====================
function renderAll() {
    console.log('Rendering all... Current range:', currentRange);
    
    if (allFunds.length === 0) return;
    
     fundData = allFunds[currentFundIndex];
    if (!fundData) return;
    
    // Get available types for this fund
     availableTypes = Object.keys(fundData.returns || {});
    
    // If current type is invalid, set to first available
    if (!currentType || !availableTypes.includes(currentType)) {
        currentType = availableTypes[0] || null;
    }
    
    // Render type buttons
    renderTypeButtons(availableTypes);
    
    // Render info
    renderInfo(fundData);
    
    // Render chart
    renderChart(fundData);
}

function renderTypeButtons(availableTypes) {
    if (!typeButtons) return;
    
    typeButtons.innerHTML = '';
    
    if (availableTypes.length === 0) return;
    
    availableTypes.forEach(type => {
         btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = type;
        btn.dataset.type = type;
        if (type === currentType) btn.classList.add('active');
        btn.addEventListener('click', () => {
            currentType = type;
            renderAll();
        });
        typeButtons.appendChild(btn);
    });
}

function renderInfo(fundData) {
     returnsData = fundData.returns && fundData.returns[currentType];
    if (!returnsData) return;
    
    if (fundNameEl) fundNameEl.textContent = fundData.fund.name || '-';
    if (typeBadgeEl) typeBadgeEl.textContent = currentType || '-';
    
    // Updated at
    if (updatedAtEl) {
        if (fundData.updated_at) {
            try {
                 d = new Date(fundData.updated_at);
                updatedAtEl.textContent = d.toLocaleDateString('fa-IR');
            } catch (e) {
                updatedAtEl.textContent = '-';
            }
        } else {
            updatedAtEl.textContent = '-';
        }
    }
    
    // Stats cards (monthly, three_months, six_months, nine_months, yearly)
    if (statsGridEl) {
         stats = [
            { label: 'یک ماهه', value: returnsData.monthly },
            { label: 'سه ماهه', value: returnsData.three_months },
            { label: 'شش ماهه', value: returnsData.six_months },
            { label: 'نه ماهه', value: returnsData.nine_months },
            { label: 'یک ساله', value: returnsData.yearly }
        ];
        
        statsGridEl.innerHTML = stats.map(s => `
            <div class="chart-stat-card">
                <div class="cs-label">${s.label}</div>
                <div class="cs-value">${s.value !== null && s.value !== undefined ? s.value.toFixed(2) + '%' : '-'}</div>
            </div>
        `).join('');
    }
}

// ==================== Chart Rendering ====================
function renderChart(fundData) {
    console.log('Rendering chart... Range:', currentRange);
    
    if (!fundData || !fundData.returns) {
        showChartError('داده‌ای برای نمایش موجود نیست');
        return;
    }
    
     returnsData = fundData.returns[currentType];
    
    if (!returnsData || !returnsData.daily_trend || returnsData.daily_trend.length === 0) {
        showChartError('داده‌ای برای نمودار موجود نیست');
        return;
    }
    
    if (errorEl) errorEl.style.display = 'none';
    
    // Sort by date
     sortedTrend = [...returnsData.daily_trend]
        .filter(item => item && item.x && typeof item.y === 'number' && !isNaN(item.y))
        .sort((a, b) => shamsiToKey(a.x) - shamsiToKey(b.x));
    
    if (sortedTrend.length === 0) {
        showChartError('داده معتبری برای نمودار یافت نشد');
        return;
    }
    
    // Filter by range
    let filteredTrend = sortedTrend;
    
    console.log('Current range in renderChart:', currentRange);
    console.log('Custom dates:', customStart, customEnd);
    
    if (currentRange === 'custom' && customStart && customEnd) {
         startKey = shamsiToKey(customStart);
         endKey = shamsiToKey(customEnd);
        filteredTrend = sortedTrend.filter(item => {
             key = shamsiToKey(item.x);
            return key >= startKey && key <= endKey;
        });
        console.log('Filtered by custom range:', filteredTrend.length, 'items');
    } else if (currentRange !== 'all' && currentRange !== 'custom' && sortedTrend.length > 0) {
         monthsMap = { '1m': 1, '3m': 3, '6m': 6, '9m': 9, '1y': 12 };
         months = monthsMap[currentRange];
        
        if (months) {
             latestDate = sortedTrend[sortedTrend.length - 1].x;
             cutoffDate = subtractMonthsShamsi(latestDate, months);
             cutoffKey = shamsiToKey(cutoffDate);
            filteredTrend = sortedTrend.filter(item => shamsiToKey(item.x) >= cutoffKey);
            console.log(`Filtered by ${months} months:`, filteredTrend.length, 'items');
        }
    }
    
    if (filteredTrend.length === 0) {
        showChartError('داده‌ای در این بازه یافت نشد');
        return;
    }
    
    // Update info
     firstPoint = filteredTrend[0];
     lastPoint = filteredTrend[filteredTrend.length - 1];
    
    if (startDateInfoEl) startDateInfoEl.textContent = firstPoint.x;
    if (endDateInfoEl) endDateInfoEl.textContent = lastPoint.x;
    
    // Calculate period return using compound formula
     rStart = firstPoint.y;
     rEnd = lastPoint.y;
    
    if (rStart !== null && rEnd !== null && rStart !== undefined && rEnd !== undefined) {
         periodReturn = ((1 + rEnd / 100) / (1 + rStart / 100) - 1) * 100;
        if (periodReturnEl) {
            periodReturnEl.textContent = periodReturn.toFixed(2) + '%';
            periodReturnEl.style.color = periodReturn >= 0 ? '#10b981' : '#ef4444';
        }
        console.log('Period return calculated:', periodReturn.toFixed(2) + '%');
    } else {
        if (periodReturnEl) periodReturnEl.textContent = '-';
    }
    
    // Prepare chart data
     dates = filteredTrend.map(item => item.x);
     values = filteredTrend.map(item => item.y);
    
    // Full date labels
     fullDates = dates.map(d => d);
    
    // Calculate smart label interval
     dataLength = filteredTrend.length;
    let labelInterval = 0;
    if (dataLength > 60) labelInterval = Math.floor(dataLength / 12);
    else if (dataLength > 30) labelInterval = Math.floor(dataLength / 8);
    else if (dataLength > 15) labelInterval = Math.floor(dataLength / 6);
    
    // Init or update chart
    if (!chartInstance) {
        chartInstance = echarts.init(chartEl);
    }
    
     primaryColor = '#4dabf7';
     primaryLight = '#2196f3';
     accentColor = '#90caf9';       // آبی خیلی روشن

     option = {
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderColor: primaryLight,
            borderWidth: 2,
            padding: [12, 16],
            textStyle: { 
                color: '#1a1a1a', 
                fontFamily: 'Vazirmatn, Vazir, IRANSans, Tahoma',
                fontSize: 13
            },
            formatter: function(params) {
                if (!params || params.length === 0) return '';
                const p = params[0];
                const idx = p.dataIndex;
                const fullDate = fullDates[idx];
                const value = p.value;
                
                return `<div style="direction:rtl;text-align:right;font-family:Vazirmatn,Vazir,IRANSans,Tahoma;">
                    <div style="font-weight:bold;margin-bottom:6px;font-size:14px;">${fullDate}</div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${primaryLight};"></span>
                        <span>بازدهی تجمعی: <strong style="color:${primaryLight};">${value.toFixed(2)}%</strong></span>
                    </div>
                </div>`;
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '12%',
            top: '8%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: fullDates,
            boundaryGap: false,
            axisLine: {
                lineStyle: { color: '#d1d5db' }
            },
            axisTick: {
                show: false
            },
            axisLabel: {
                fontSize: 12,
                color: '#e2e8f0',  // روشن‌تر
                fontFamily: 'Vazirmatn, Vazir, IRANSans, Tahoma',
                interval: labelInterval,
                rotate: dataLength > 30 ? 30 : 0,
                margin: 14,
                formatter: function(value) {
                    const p = value.split('/');
                    if (p.length === 3) {
                        return `${p[1]}/${p[2]}`;
                    }
                    return value;
                }
            },
        },
        yAxis: {
            type: 'value',
            name: 'بازدهی (%)',
            nameTextStyle: { 
                fontFamily: 'Vazirmatn, Vazir, IRANSans, Tahoma', 
                fontSize: 12,
                color: '#4b5563',
                padding: [0, 0, 0, 10]
            },
            axisLabel: {
                fontSize: 11,
                color: '#4b5563',
                fontFamily: 'Vazirmatn, Vazir, IRANSans, Tahoma',
                formatter: '{value}%'
            },
            splitLine: {
                lineStyle: { 
                    color: '#f3f4f6', 
                    type: 'dashed',
                    width: 1
                }
            },
            axisLine: {
                show: false
            }
        },
        dataZoom: [
            { 
                type: 'inside', 
                start: 0, 
                end: 100,
                throttle: 50
            },
            { 
                type: 'slider', 
                start: 0, 
                end: 100,
                height: 25,
                bottom: 5,
                borderColor: '#e5e7eb',
                backgroundColor: '#fafafa',
                fillerColor: 'rgba(30, 60, 114, 0.15)',
                handleStyle: { 
                    color: primaryLight,
                    borderColor: primaryLight
                },
                moveHandleStyle: {
                    color: primaryLight
                },
                textStyle: { 
                    fontSize: 10, 
                    fontFamily: 'Vazirmatn, Vazir, IRANSans, Tahoma',
                    color: '#4b5563'
                },
                showDetail: true,
                showDataShadow: true
            }
        ],
        series: [{
            name: `بازدهی ${currentType}`,
            type: 'line',
            data: values,
            smooth: true,
            smoothMonotone: 'x',
            symbol: 'circle',
            symbolSize: 5,
            showSymbol: false,
            lineStyle: {
                width: 4.5,
                color: '#4dabf7',
                shadowColor: 'rgba(42, 82, 152, 0.3)',
                shadowBlur: 8,
                shadowOffsetY: 3,
                cap: 'round'
            },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(42, 82, 152, 0.35)' },
                        { offset: 0.5, color: 'rgba(42, 82, 152, 0.15)' },
                        { offset: 1, color: 'rgba(42, 82, 152, 0.02)' }
                    ]
                }
            },
            itemStyle: {
                color: primaryLight,
                borderColor: '#ffffff',
                borderWidth: 2
            },
            emphasis: {
                focus: 'series',
                lineStyle: { 
                    width: 3.5,
                    shadowBlur: 12
                },
                itemStyle: {
                    borderWidth: 3,
                    shadowBlur: 8
                }
            },
            animationDuration: 1000,
            animationEasing: 'cubicOut',
            animationDurationUpdate: 500,
            animationEasingUpdate: 'cubicInOut'
        }],
        legend: {
            show: true,
            top: 0,
            right: 0,
            textStyle: {
                fontFamily: 'Vazirmatn, Vazir, IRANSans, Tahoma',
                fontSize: 12,
                color: '#4b5563'
            },
            icon: 'roundRect',
            itemWidth: 16,
            itemHeight: 8
        },
        backgroundColor: 'transparent'
    };
    
    chartInstance.setOption(option, true);
    chartInstance.resize();
    
    console.log('Chart rendered with', filteredTrend.length, 'data points');
}

function showChartError(message) {
    console.error('Chart error:', message);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
    if (loadingEl) loadingEl.style.display = 'none';
}

// ==================== Handle Window Resize ====================
window.addEventListener('resize', () => {
    if (chartInstance) {
        chartInstance.resize();
    }
});

// ==================== Init ====================
let initialized = false;

function initApp() {
    if (initialized) return;
    initialized = true;
    console.log('Initializing Fund Chart app...');
    loadFunds();
}

document.addEventListener('DOMContentLoaded', initApp);

// Fallback for cases where DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initApp();
} else {
    window.addEventListener('load', initApp);
}
