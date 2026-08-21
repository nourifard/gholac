/* ==================== Fund Chart Component ==================== */
/* نسخه: 1.0.0 */
/* توضیحات: کامپوننت نمودار تعاملی صندوق‌های سرمایه‌گذاری */

'use strict';

class FundChart {
    constructor() {
        // DOM Elements
        this.fundSelect = document.getElementById('fundSelect');
        this.returnsTypeButtons = document.getElementById('returnsTypeButtons');
        this.rangeButtons = document.getElementById('rangeButtons');
        this.customRangeGroup = document.getElementById('customRangeGroup');
        this.startDateInput = document.getElementById('startDate');
        this.endDateInput = document.getElementById('endDate');
        this.applyCustomRangeBtn = document.getElementById('applyCustomRange');
        this.chartContainer = document.getElementById('chartContainer');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.errorMessage = document.getElementById('errorMessage');
        this.performanceCard = document.getElementById('performanceCard');
        this.fundNameDisplay = document.getElementById('fundNameDisplay');
        this.returnsTypeBadge = document.getElementById('returnsTypeBadge');
        this.periodReturnDisplay = document.getElementById('periodReturn');
        this.startDateDisplay = document.getElementById('startDateDisplay');
        this.endDateDisplay = document.getElementById('endDateDisplay');
        this.lastUpdateDisplay = document.getElementById('lastUpdate');
        this.chartLegend = document.getElementById('chartLegend');

        // State
        this.fundsData = [];
        this.selectedFundIndex = null;
        this.selectedReturnsType = 'صدور';
        this.selectedRange = '1y';
        this.customStartDate = null;
        this.customEndDate = null;
        this.chart = null;
        this.isLoading = false;

        // Initialize
        this.init();
    }

    async init() {
        this.showLoading(true);
        this.bindEvents();
        
        try {
            await this.loadData();
            this.initializeControls();
            this.updateChart();
            this.showLoading(false);
        } catch (error) {
            console.error('Error initializing chart:', error);
            this.showError('خطا در بارگذاری داده‌ها. لطفاً دوباره تلاش کنید.');
            this.showLoading(false);
        }
    }

    // ==================== Data Loading ====================
    async loadData() {
        try {
            const response = await fetch('./funds.json', {
                cache: 'no-cache',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data || !data.funds || !Array.isArray(data.funds) || data.funds.length === 0) {
                throw new Error('Invalid or empty funds data');
            }

            this.fundsData = data.funds.filter(fund => 
                fund && fund.fund && fund.returns
            );

            if (this.fundsData.length === 0) {
                throw new Error('No valid funds found');
            }

            console.log(`Successfully loaded ${this.fundsData.length} funds`);
        } catch (error) {
            console.error('Failed to load funds data:', error);
            throw error;
        }
    }

    // ==================== Controls Initialization ====================
    initializeControls() {
        this.populateFundSelect();
        this.populateReturnsTypeButtons();
        this.setupRangeButtons();
        this.setupCustomRange();
    }

    populateFundSelect() {
        this.fundSelect.innerHTML = '';
        
        this.fundsData.forEach((fundData, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = fundData.fund.name;
            this.fundSelect.appendChild(option);
        });

        if (this.fundsData.length > 0) {
            this.selectedFundIndex = 0;
            this.fundSelect.value = 0;
        }
    }

    populateReturnsTypeButtons() {
        this.returnsTypeButtons.innerHTML = '';
        
        if (!this.fundsData.length || this.selectedFundIndex === null) return;
        
        const currentFund = this.fundsData[this.selectedFundIndex];
        const returnsTypes = Object.keys(currentFund.returns);
        
        if (returnsTypes.length === 0) {
            this.showError('هیچ نوع قیمتی برای این صندوق موجود نیست');
            return;
        }

        // اگر نوع انتخاب شده قبلی موجود نیست، اولین نوع را انتخاب کن
        if (!returnsTypes.includes(this.selectedReturnsType)) {
            this.selectedReturnsType = returnsTypes[0];
        }

        returnsTypes.forEach(type => {
            const button = document.createElement('button');
            button.className = 'btn returns-type-btn';
            button.dataset.type = type;
            button.textContent = type;
            
            if (type === this.selectedReturnsType) {
                button.classList.add('active');
            }
            
            this.returnsTypeButtons.appendChild(button);
        });

        // Bind events for return type buttons
        document.querySelectorAll('.returns-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectReturnsType(e.target.dataset.type);
            });
        });
    }

    setupRangeButtons() {
        const rangeButtons = document.querySelectorAll('.range-btn[data-range]');
        
        rangeButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.range === this.selectedRange) {
                btn.classList.add('active');
            }
        });
    }

    setupCustomRange() {
        this.startDateInput.value = '';
        this.endDateInput.value = '';
        this.customRangeGroup.style.display = 'none';
    }

    // ==================== Event Binding ====================
    bindEvents() {
        // Fund selection
        this.fundSelect.addEventListener('change', (e) => {
            this.selectedFundIndex = parseInt(e.target.value);
            this.selectedReturnsType = 'صدور'; // Reset to default
            this.populateReturnsTypeButtons();
            this.updateChart();
        });

        // Range buttons
        document.querySelectorAll('.range-btn[data-range]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const range = e.target.closest('.range-btn').dataset.range;
                this.selectRange(range);
            });
        });

        // Custom range buttons
        this.applyCustomRangeBtn.addEventListener('click', () => {
            this.applyCustomRange();
        });

        // Date input validation
        this.startDateInput.addEventListener('input', () => {
            this.validateDateInput(this.startDateInput);
        });

        this.endDateInput.addEventListener('input', () => {
            this.validateDateInput(this.endDateInput);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCustomRange();
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            if (this.chart) {
                this.chart.resize();
            }
        });
    }

    // ==================== Selection Handlers ====================
    selectReturnsType(type) {
        this.selectedReturnsType = type;
        
        document.querySelectorAll('.returns-type-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.type === type) {
                btn.classList.add('active');
            }
        });
        
        this.updateChart();
    }

    selectRange(range) {
        this.selectedRange = range;
        
        document.querySelectorAll('.range-btn[data-range]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.range === range) {
                btn.classList.add('active');
            }
        });

        if (range === 'custom') {
            this.customRangeGroup.style.display = 'block';
            this.customRangeGroup.classList.add('fade-in');
        } else {
            this.customRangeGroup.style.display = 'none';
            this.updateChart();
        }
    }

    applyCustomRange() {
        const startDate = this.startDateInput.value.trim();
        const endDate = this.endDateInput.value.trim();

        if (!this.validateDateInput(this.startDateInput) || 
            !this.validateDateInput(this.endDateInput)) {
            this.showError('لطفاً تاریخ‌های معتبر وارد کنید');
            return;
        }

        if (!this.compareDates(startDate, endDate)) {
            this.showError('تاریخ شروع باید قبل از تاریخ پایان باشد');
            this.startDateInput.classList.add('error');
            this.endDateInput.classList.add('error');
            return;
        }

        this.customStartDate = startDate;
        this.customEndDate = endDate;
        this.selectedRange = 'custom';
        
        this.updateChart();
    }

    closeCustomRange() {
        this.customRangeGroup.style.display = 'none';
        this.selectRange('1y');
    }

    // ==================== Date Utilities ====================
    validateDateInput(input) {
        const value = input.value.trim();
        const datePattern = /^(\d{4})\/(\d{2})\/(\d{2})$/;
        
        if (!datePattern.test(value)) {
            input.classList.add('error');
            return false;
        }

        const match = value.match(datePattern);
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);

        if (year < 1300 || year > 1450) {
            input.classList.add('error');
            return false;
        }

        if (month < 1 || month > 12) {
            input.classList.add('error');
            return false;
        }

        const maxDays = this.getDaysInMonth(year, month);
        if (day < 1 || day > maxDays) {
            input.classList.add('error');
            return false;
        }

        input.classList.remove('error');
        return true;
    }

    getDaysInMonth(year, month) {
        if (month <= 6) return 31;
        if (month <= 11) return 30;
        if (month === 12) {
            // Check for leap year in Persian calendar
            return this.isLeapYear(year) ? 30 : 29;
        }
        return 30;
    }

    isLeapYear(year) {
        // Simplified Persian leap year calculation
        // This is approximate and may need refinement
        const cycles = [1, 5, 9, 13, 17, 22, 26, 30];
        const cycleIndex = (year - 1300) % 33;
        return cycles.includes(cycleIndex);
    }

    compareDates(startDate, endDate) {
        const start = startDate.split('/').map(Number);
        const end = endDate.split('/').map(Number);
        
        for (let i = 0; i < 3; i++) {
            if (start[i] < end[i]) return true;
            if (start[i] > end[i]) return false;
        }
        return true; // Equal dates are valid
    }

    formatDateDisplay(dateStr) {
        if (!dateStr) return '-';
        return dateStr;
    }

    // ==================== Data Processing ====================
    getCurrentFundData() {
        if (this.selectedFundIndex === null || !this.fundsData.length) {
            return null;
        }
        return this.fundsData[this.selectedFundIndex];
    }

    getReturnsData(fundData) {
        if (!fundData || !fundData.returns) return null;
        return fundData.returns[this.selectedReturnsType];
    }

    getFilteredTrendData(returnsData) {
        if (!returnsData || !returnsData.daily_trend || returnsData.daily_trend.length === 0) {
            return [];
        }

        let trendData = returnsData.daily_trend.filter(item => 
            item && item.x && typeof item.y === 'number' && !isNaN(item.y)
        );

        if (this.selectedRange === 'all') {
            return trendData;
        }

        if (this.selectedRange === 'custom') {
            if (this.customStartDate && this.customEndDate) {
                return trendData.filter(item => {
                    return this.compareDates(item.x, this.customStartDate) && 
                           this.compareDates(this.customEndDate, item.x);
                });
            }
            return trendData;
        }

        // For predefined ranges (1m, 3m, 6m, 9m, 1y)
        const monthsMap = {
            '1m': 1,
            '3m': 3,
            '6m': 6,
            '9m': 9,
            '1y': 12
        };

        const months = monthsMap[this.selectedRange];
        if (!months || trendData.length === 0) return trendData;

        // Get the latest date
        const latestDate = trendData[trendData.length - 1].x;
        const cutoffDate = this.subtractMonths(latestDate, months);
        
        return trendData.filter(item => this.compareDates(item.x, cutoffDate));
    }

    subtractMonths(dateStr, months) {
        const parts = dateStr.split('/').map(Number);
        let year = parts[0];
        let month = parts[1] - months;
        
        while (month <= 0) {
            month += 12;
            year--;
        }
        
        const day = Math.min(parts[2], this.getDaysInMonth(year, month));
        return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    }

    calculatePeriodReturn(trendData) {
        if (!trendData || trendData.length < 2) return null;
        
        const startValue = trendData[0].y;
        const endValue = trendData[trendData.length - 1].y;
        
        if (typeof startValue !== 'number' || typeof endValue !== 'number') {
            return null;
        }

        // Use compound return formula: ((1 + R_end/100) / (1 + R_start/100) - 1) * 100
        const compoundReturn = ((1 + endValue / 100) / (1 + startValue / 100) - 1) * 100;
        
        return compoundReturn;
    }

    // ==================== Chart Rendering ====================
    updateChart() {
        const fundData = this.getCurrentFundData();
        if (!fundData) {
            this.showError('داده‌ای برای نمایش موجود نیست');
            return;
        }

        const returnsData = this.getReturnsData(fundData);
        if (!returnsData) {
            this.showError(`نوع قیمت "${this.selectedReturnsType}" برای این صندوق موجود نیست`);
            return;
        }

        const trendData = this.getFilteredTrendData(returnsData);
        
        if (!trendData || trendData.length === 0) {
            this.showError('داده‌ای برای بازه انتخابی موجود نیست');
            return;
        }

        // Update info display
        this.updateInfoDisplay(fundData, returnsData, trendData);
        
        // Render chart
        this.renderChart(fundData, trendData);
    }

    updateInfoDisplay(fundData, returnsData, trendData) {
        // Fund name and type
        this.fundNameDisplay.textContent = fundData.fund.name;
        this.returnsTypeBadge.textContent = this.selectedReturnsType;
        
        // Period return
        const periodReturn = this.calculatePeriodReturn(trendData);
        this.periodReturnDisplay.textContent = periodReturn !== null ? periodReturn.toFixed(2) : '-';
        
        // Add color class based on positive/negative
        if (periodReturn !== null) {
            this.periodReturnDisplay.style.color = periodReturn >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        }
        
        // Dates
        this.startDateDisplay.textContent = this.formatDateDisplay(trendData[0].x);
        this.endDateDisplay.textContent = this.formatDateDisplay(trendData[trendData.length - 1].x);
        
        // Last update
        if (fundData.updated_at) {
            const updateDate = new Date(fundData.updated_at);
            this.lastUpdateDisplay.textContent = updateDate.toLocaleDateString('fa-IR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } else {
            this.lastUpdateDisplay.textContent = '-';
        }
        
        // Chart legend
        this.chartLegend.textContent = `بازدهی تجمعی (${this.selectedReturnsType})`;
    }

    renderChart(fundData, trendData) {
        // Clear previous chart
        if (this.chart) {
            this.chart.dispose();
            this.chart = null;
        }

        // Initialize ECharts
        this.chart = echarts.init(this.chartContainer);
        
        // Prepare data
        const dates = trendData.map(item => item.x);
        const values = trendData.map(item => item.y);
        
        // Convert Persian dates to display format
        const displayDates = dates.map(date => this.formatDateForDisplay(date));
        
        const option = {
            // Tooltip configuration
            tooltip: {
                trigger: 'axis',
                position: function (pt) {
                    return [pt[0] + 10, pt[1] - 10];
                },
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#4f46e5',
                borderWidth: 2,
                padding: [10, 15],
                textStyle: {
                    color: '#1f2937',
                    fontSize: 12,
                    fontFamily: 'Vazir, IRANSans, Tahoma'
                },
                formatter: function(params) {
                    if (!params || params.length === 0) return '';
                    
                    const param = params[0];
                    const date = param.name;
                    const value = param.value;
                    
                    return `<div style="direction: rtl; text-align: right;">
                        <div style="font-weight: bold; margin-bottom: 5px;">${date}</div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
                            <span>بازدهی: <strong>${value.toFixed(2)}٪</strong></span>
                        </div>
                    </div>`;
                }
            },
            
            // Grid configuration
            grid: {
                left: '3%',
                right: '3%',
                bottom: '8%',
                top: '5%',
                containLabel: true
            },
            
            // X-Axis (Dates)
            xAxis: {
                type: 'category',
                data: displayDates,
                boundaryGap: false,
                axisLine: {
                    lineStyle: {
                        color: '#d1d5db'
                    }
                },
                axisLabel: {
                    color: '#6b7280',
                    fontSize: 11,
                    fontFamily: 'Vazir, IRANSans, Tahoma',
                    rotate: 45,
                    interval: Math.floor(displayDates.length / 10) || 0
                }
            },
            
            // Y-Axis (Returns)
            yAxis: {
                type: 'value',
                name: 'بازدهی (٪)',
                nameTextStyle: {
                    fontFamily: 'Vazir, IRANSans, Tahoma',
                    fontSize: 12,
                    color: '#6b7280',
                    padding: [0, 0, 0, 10]
                },
                axisLine: {
                    show: false
                },
                axisLabel: {
                    color: '#6b7280',
                    fontSize: 11,
                    fontFamily: 'Vazir, IRANSans, Tahoma'
                },
                splitLine: {
                    lineStyle: {
                        color: '#f3f4f6',
                        type: 'dashed'
                    }
                }
            },
            
            // Data Series
            series: [{
                name: `بازدهی ${this.selectedReturnsType}`,
                type: 'line',
                data: values,
                smooth: true,
                symbol: 'circle',
                symbolSize: 4,
                showSymbol: false,
                
                // Line styling
                lineStyle: {
                    width: 3,
                    color: '#4f46e5',
                    shadowColor: 'rgba(79, 70, 229, 0.3)',
                    shadowBlur: 10,
                    shadowOffsetY: 5
                },
                
                // Area styling
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [
                            {
                                offset: 0,
                                color: 'rgba(79, 70, 229, 0.3)'
                            },
                            {
                                offset: 1,
                                color: 'rgba(79, 70, 229, 0.02)'
                            }
                        ]
                    }
                },
                
                // Item styling
                itemStyle: {
                    color: '#4f46e5',
                    borderColor: '#ffffff',
                    borderWidth: 2
                },
                
                // Hover styling
                emphasis: {
                    focus: 'series',
                    lineStyle: {
                        width: 4
                    },
                    itemStyle: {
                        borderWidth: 3
                    }
                },
                
                // Animation
                animationDuration: 1000,
                animationDurationUpdate: 500,
                animationEasing: 'cubicOut',
                animationEasingUpdate: 'cubicInOut'
            }],
            
            // Data Zoom
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
                    height: 20,
                    bottom: 10,
                    borderColor: '#d1d5db',
                    backgroundColor: '#f9fafb',
                    fillerColor: 'rgba(79, 70, 229, 0.2)',
                    handleStyle: {
                        color: '#4f46e5'
                    },
                    textStyle: {
                        color: '#6b7280',
                        fontSize: 10,
                        fontFamily: 'Vazir, IRANSans, Tahoma'
                    }
                }
            ],
            
            // Legend
            legend: {
                show: false
            }
        };
        
        // Set chart option
        this.chart.setOption(option);
        
        // Enable dark mode support
        this.chart.on('finished', () => {
            console.log('Chart rendered successfully');
        });
        
        // Add window resize handler
        window.addEventListener('resize', () => {
            if (this.chart) {
                this.chart.resize();
            }
        });
    }

    formatDateForDisplay(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return `${parts[1]}/${parts[2]}`;
        }
        return dateStr;
    }

    // ==================== UI Helpers ====================
    showLoading(show) {
        this.isLoading = show;
        if (this.loadingOverlay) {
            if (show) {
                this.loadingOverlay.style.display = 'flex';
                this.loadingOverlay.classList.remove('hidden');
            } else {
                this.loadingOverlay.classList.add('hidden');
                setTimeout(() => {
                    this.loadingOverlay.style.display = 'none';
                }, 300);
            }
        }
    }

    showError(message) {
        if (this.errorMessage) {
            this.errorMessage.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            `;
            this.errorMessage.style.display = 'block';
            
            // Hide error after 5 seconds
            clearTimeout(this.errorTimeout);
            this.errorTimeout = setTimeout(() => {
                this.errorMessage.style.display = 'none';
            }, 5000);
        }
    }

    clearError() {
        if (this.errorMessage) {
            this.errorMessage.style.display = 'none';
        }
    }
}

// Initialize chart when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        const fundChart = new FundChart();
        // Expose to global scope for debugging
        window.fundChart = fundChart;
        console.log('Fund Chart initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Fund Chart:', error);
    }
});
