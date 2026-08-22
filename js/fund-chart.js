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
    const p = parseShamsi(str);
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
    const leapYears = [1, 5, 9, 13, 17, 22, 26, 30];
    const cycleIndex = ((year - 1300) % 33 + 33) % 33;
    const isLeap = leapYears.includes(cycleIndex);
    let maxDay;
    if (month <= 6) maxDay = 31;
    else if (month <= 11) maxDay = 30;
    else maxDay = isLeap ? 30 : 29;
    
    if (day > maxDay) day = maxDay;
    return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

function findClosestDate(trendData, targetDateStr) {
    if (!trendData || trendData.length === 0) return null;
    const targetKey = shamsiToKey(targetDateStr);
    let closest = trendData[0];
    let minDiff = Infinity;
    for (const item of trendData) {
        const diff = Math.abs(shamsiToKey(item.x) - targetKey);
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
        const res = await fetch('./funds.json', { cache: 'no-cache' });
        console.log('Fetch response status:', res.status);
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await res.json();
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
            const opt = document.createElement('option');
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
                const range = btn.dataset.range;
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
    const pattern = /^\d{4}\/\d{2}\/\d{2}$/;
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
    
    const fundData = allFunds[currentFundIndex];
    if (!fundData) return;
    
    // Get available types for this fund
    const availableTypes = Object.keys(fundData.returns || {});
    
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
        const btn = document.createElement('button');
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
    const returnsData = fundData.returns && fundData.returns[currentType];
    if (!returnsData) return;
    
    if (fundNameEl) fundNameEl.textContent = fundData.fund.name || '-';
    if (typeBadgeEl) typeBadgeEl.textContent = currentType || '-';
    
    // Updated at
    if (updatedAtEl) {
        if (fundData.updated_at) {
            try {
                const d = new Date(fundData.updated_at);
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
        const stats = [
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
    
    const returnsData = fundData.returns[currentType];
    
    if (!returnsData || !returnsData.daily_trend || returnsData.daily_trend.length === 0) {
        showChartError('داده‌ای برای نمودار موجود نیست');
        return;
    }
    
    if (errorEl) errorEl.style.display = 'none';
    
    // Sort by date
    const sortedTrend = [...returnsData.daily_trend]
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
        const startKey = shamsiToKey(customStart);
        const endKey = shamsiToKey(customEnd);
        filteredTrend = sortedTrend.filter(item => {
            const key = shamsiToKey(item.x);
            return key >= startKey && key <= endKey;
        });
        console.log('Filtered by custom range:', filteredTrend.length, 'items');
    } else if (currentRange !== 'all' && currentRange !== 'custom' && sortedTrend.length > 0) {
        const monthsMap = { '1m': 1, '3m': 3, '6m': 6, '9m': 9, '1y': 12 };
        const months = monthsMap[currentRange];
        
        if (months) {
            const latestDate = sortedTrend[sortedTrend.length - 1].x;
            const cutoffDate = subtractMonthsShamsi(latestDate, months);
            const cutoffKey = shamsiToKey(cutoffDate);
            filteredTrend = sortedTrend.filter(item => shamsiToKey(item.x) >= cutoffKey);
            console.log(`Filtered by ${months} months:`, filteredTrend.length, 'items');
        }
    }
    
    if (filteredTrend.length === 0) {
        showChartError('داده‌ای در این بازه یافت نشد');
        return;
    }
    
    // Update info
    const firstPoint = filteredTrend[0];
    const lastPoint = filteredTrend[filteredTrend.length - 1];
    
    if (startDateInfoEl) startDateInfoEl.textContent = firstPoint.x;
    if (endDateInfoEl) endDateInfoEl.textContent = lastPoint.x;
    
    // Calculate period return using compound formula
    const rStart = firstPoint.y;
    const rEnd = lastPoint.y;
    
    if (rStart !== null && rEnd !== null && rStart !== undefined && rEnd !== undefined) {
        const periodReturn = ((1 + rEnd / 100) / (1 + rStart / 100) - 1) * 100;
        if (periodReturnEl) {
            periodReturnEl.textContent = periodReturn.toFixed(2) + '%';
            periodReturnEl.style.color = periodReturn >= 0 ? '#10b981' : '#ef4444';
        }
        console.log('Period return calculated:', periodReturn.toFixed(2) + '%');
    } else {
        if (periodReturnEl) periodReturnEl.textContent = '-';
    }
    
    // Prepare chart data
    const dates = filteredTrend.map(item => item.x);
    const values = filteredTrend.map(item => item.y);
    
    // Full date labels
    const fullDates = dates.map(d => d);
    
    // Calculate smart label interval
    const dataLength = filteredTrend.length;
    let labelInterval = 0;
    if (dataLength > 60) labelInterval = Math.floor(dataLength / 12);
    else if (dataLength > 30) labelInterval = Math.floor(dataLength / 8);
    else if (dataLength > 15) labelInterval = Math.floor(dataLength / 6);
    
    // Init or update chart
    if (!chartInstance) {
        chartInstance = echarts.init(chartEl);
    }
    
    // ==================== رنگ‌های نمودار (آبی روشن) ====================
    const lineColor = '#4dabf7';        // آبی روشن برای خط
    const lineGlow = 'rgba(77, 171, 247, 0.5)';
    const areaTopColor = 'rgba(77, 171, 247, 0.35)';
    const areaMidColor = 'rgba(33, 150, 243, 0.15)';
    const areaBottomColor = 'rgba(33, 150, 243, 0.02)';
    const axisLabelColor = '#e2e8f0';
    const axisLineColor = '#334155';
    const splitLineColor = '#1e293b';
    const tooltipBg = 'rgba(15, 21, 37, 0.95)';
    const tooltipBorder = '#4dabf7';
    
    const option = {
        tooltip: {
            trigger: 'axis',
            backgroundColor: tooltipBg,
            borderColor: tooltipBorder,
            borderWidth: 2,
            padding: [14, 18],
            textStyle: { 
                color: '#f1f5f9', 
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
                    <div style="font-weight:bold;margin-bottom:8px;font-size:15px;color:#f1f5f9;">${fullDate}</div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${lineColor};box-shadow:0 0 8px ${lineColor};"></span>
                        <span style="color:#cbd5e1;">بازدهی تجمعی: <strong style="color:${lineColor};font-size:16px;">${value.toFixed(2)}%</strong></span>
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
                lineStyle: { color: axisLineColor, width: 1.5 }
            },
            axisTick: {
                show: false
            },
            axisLabel: {
                fontSize: 12,
                color: axisLabelColor,
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
            }
        },
        yAxis: {
            type: 'value',
            name: 'بازدهی (%)',
            nameTextStyle: { 
                fontFamily: 'Vazirmatn, Vazir, IRANSans, Tahoma', 
                fontSize: 13,
                color: axisLabelColor,
                padding: [0, 0, 0, 12]
            },
            axisLabel: {
                fontSize: 12,
                color: axisLabelColor,
                fontFamily: 'Vazirmatn, Vazir, IRANSans, Tahoma',
                formatter: '{value}%'
            },
            splitLine: {
                lineStyle: { 
                    color: splitLineColor, 
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
                height: 28,
                bottom: 8,
                borderColor: '#334155',
                backgroundColor: '#0f1525',
                fillerColor: 'rgba(77, 171, 247, 0.15)',
                handleStyle: { 
                    color: lineColor,
                    borderColor: lineColor
                },
                moveHandleStyle: {
                    color: lineColor
                },
                textStyle: { 
                    fontSize: 11, 
                    fontFamily: 'Vazirmatn, Vazir, IRANSans, Tahoma',
                    color: '#cbd5e1'
                },
                showDetail: true,
                showDataShadow: true,
                dataBackground: {
                    lineStyle: {
                        color: lineColor,
                        opacity: 0.3
                    },
                    areaStyle: {
                        color: 'rgba(77, 171, 247, 0.05)',
                        opacity: 0.5
                    }
                }
            }
        ],
        series: [{
            name: `بازدهی ${currentType}`,
            type: 'line',
            data: values,
            smooth: true,
            smoothMonotone: 'x',
            symbol: 'circle',
            symbolSize: 6,
            showSymbol: false,
            
            // خط نمودار - آبی روشن
            lineStyle: {
                width: 3,
                color: lineColor,
                shadowColor: lineGlow,
                shadowBlur: 12,
                shadowOffsetY: 5,
                cap: 'round'
            },
            
            // ناحیه زیر نمودار - گرادیان آبی روشن
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: areaTopColor },
                        { offset: 0.5, color: areaMidColor },
                        { offset: 1, color: areaBottomColor }
                    ]
                }
            },
            
            // نقاط نمودار
            itemStyle: {
                color: lineColor,
                borderColor: '#0a0e1a',
                borderWidth: 2
            },
            
            // حالت hover
            emphasis: {
                focus: 'series',
                lineStyle: { 
                    width: 4,
                    shadowBlur: 20,
                    shadowColor: 'rgba(77, 171, 247, 0.6)'
                },
                itemStyle: {
                    borderWidth: 3,
                    shadowBlur: 12,
                    shadowColor: 'rgba(77, 171, 247, 0.5)'
                }
            },
            
            // انیمیشن
            animationDuration: 1200,
            animationEasing: 'cubicOut',
            animationDurationUpdate: 600,
            animationEasingUpdate: 'cubicInOut'
        }],
        
        // Legend
        legend: {
            show: true,
            top: 0,
            right: 0,
            textStyle: {
                fontFamily: 'Vazirmatn, Vazir, IRANSans, Tahoma',
                fontSize: 13,
                color: '#e2e8f0'
            },
            icon: 'roundRect',
            itemWidth: 20,
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
