// ==================== Chart ====================
function renderChart(fundData) {
    const returnsData = fundData.returns[currentType];
    if (!returnsData || !returnsData.daily_trend || returnsData.daily_trend.length === 0) {
        if (chartInstance) {
            chartInstance.clear();
        }
        errorEl.textContent = 'داده‌ای برای نمودار موجود نیست';
        errorEl.style.display = 'block';
        return;
    }
    
    errorEl.style.display = 'none';
    
    // Sort by date
    const sortedTrend = [...returnsData.daily_trend].sort((a, b) => 
        shamsiToKey(a.x) - shamsiToKey(b.x)
    );
    
    // Filter by range
    let filteredTrend = sortedTrend;
    
    if (currentRange === 'custom' && customStart && customEnd) {
        const startKey = shamsiToKey(customStart);
        const endKey = shamsiToKey(customEnd);
        filteredTrend = sortedTrend.filter(item => {
            const key = shamsiToKey(item.x);
            return key >= startKey && key <= endKey;
        });
    } else if (currentRange !== 'all' && sortedTrend.length > 0) {
        const monthsMap = { '1m': 1, '3m': 3, '6m': 6, '9m': 9, '1y': 12 };
        const months = monthsMap[currentRange];
        if (months) {
            const latestDate = sortedTrend[sortedTrend.length - 1].x;
            const cutoffDate = subtractMonthsShamsi(latestDate, months);
            const cutoffKey = shamsiToKey(cutoffDate);
            filteredTrend = sortedTrend.filter(item => shamsiToKey(item.x) >= cutoffKey);
        }
    }
    
    if (filteredTrend.length === 0) {
        errorEl.textContent = 'داده‌ای در این بازه یافت نشد';
        errorEl.style.display = 'block';
        return;
    }
    
    // Update info
    const firstPoint = filteredTrend[0];
    const lastPoint = filteredTrend[filteredTrend.length - 1];
    
    startDateInfoEl.textContent = firstPoint.x;
    endDateInfoEl.textContent = lastPoint.x;
    
    // Calculate period return using compound formula
    const rStart = firstPoint.y;
    const rEnd = lastPoint.y;
    if (rStart !== null && rEnd !== null && rStart !== undefined && rEnd !== undefined) {
        const periodReturn = ((1 + rEnd / 100) / (1 + rStart / 100) - 1) * 100;
        periodReturnEl.textContent = periodReturn.toFixed(2) + '%';
        periodReturnEl.style.color = periodReturn >= 0 ? '#10b981' : '#ef4444';
    } else {
        periodReturnEl.textContent = '-';
    }
    
    // Prepare chart data
    const dates = filteredTrend.map(item => item.x);
    const values = filteredTrend.map(item => item.y);
    
    // Full date labels for better display
    const fullDates = dates.map(d => {
        const p = d.split('/');
        return `${p[0]}/${p[1]}/${p[2]}`;
    });
    
    // Short date labels for tooltip
    const shortDates = dates.map(d => {
        const p = d.split('/');
        return `${p[1]}/${p[2]}`;
    });
    
    // Calculate smart label interval based on data length
    const dataLength = filteredTrend.length;
    let labelInterval = 0; // 0 = auto
    if (dataLength > 60) labelInterval = Math.floor(dataLength / 12);
    else if (dataLength > 30) labelInterval = Math.floor(dataLength / 8);
    else if (dataLength > 15) labelInterval = Math.floor(dataLength / 6);
    
    // Init or update chart
    if (!chartInstance) {
        chartInstance = echarts.init(chartEl);
    }
    
    // Color palette
    const primaryColor = '#1e3c72';
    const primaryLight = '#2a5298';
    const accentColor = '#4f8cff';
    
    const option = {
        // Tooltip
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            borderColor: primaryLight,
            borderWidth: 2,
            padding: [12, 16],
            textStyle: { 
                color: '#1a1a1a', 
                fontFamily: 'Vazir, IRANSans, Tahoma',
                fontSize: 13
            },
            formatter: function(params) {
                const p = params[0];
                const idx = p.dataIndex;
                const fullDate = fullDates[idx];
                const value = p.value;
                
                return `<div style="direction:rtl;text-align:right;font-family:Vazir,IRANSans,Tahoma;">
                    <div style="font-weight:bold;margin-bottom:6px;font-size:14px;">${fullDate}</div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${primaryLight};"></span>
                        <span>بازدهی تجمعی: <strong style="color:${primaryLight};">${value.toFixed(2)}%</strong></span>
                    </div>
                </div>`;
            }
        },
        
        // Grid
        grid: {
            left: '3%',
            right: '4%',
            bottom: '12%',
            top: '8%',
            containLabel: true
        },
        
        // X-Axis
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
                fontSize: 11,
                color: '#4b5563',
                fontFamily: 'Vazir, IRANSans, Tahoma',
                interval: labelInterval,
                rotate: dataLength > 30 ? 30 : 0,
                margin: 12,
                formatter: function(value) {
                    const p = value.split('/');
                    return `${p[1]}/${p[2]}`;
                }
            }
        },
        
        // Y-Axis
        yAxis: {
            type: 'value',
            name: 'بازدهی (%)',
            nameTextStyle: { 
                fontFamily: 'Vazir, IRANSans, Tahoma', 
                fontSize: 12,
                color: '#4b5563',
                padding: [0, 0, 0, 10]
            },
            axisLabel: {
                fontSize: 11,
                color: '#4b5563',
                fontFamily: 'Vazir, IRANSans, Tahoma',
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
                    fontFamily: 'Vazir, IRANSans, Tahoma',
                    color: '#4b5563'
                },
                showDetail: true,
                showDataShadow: true
            }
        ],
        
        // Series
        series: [{
            name: `بازدهی ${currentType}`,
            type: 'line',
            data: values,
            smooth: true,
            smoothMonotone: 'x',
            symbol: 'circle',
            symbolSize: 5,
            showSymbol: false,
            
            // Line styling
            lineStyle: {
                width: 2.5,
                color: primaryLight,
                shadowColor: 'rgba(42, 82, 152, 0.3)',
                shadowBlur: 8,
                shadowOffsetY: 3,
                cap: 'round'
            },
            
            // Area styling
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
            
            // Item styling
            itemStyle: {
                color: primaryLight,
                borderColor: '#ffffff',
                borderWidth: 2
            },
            
            // Hover emphasis
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
            
            // Animation
            animationDuration: 1000,
            animationEasing: 'cubicOut',
            animationDurationUpdate: 500,
            animationEasingUpdate: 'cubicInOut'
        }],
        
        // Legend
        legend: {
            show: true,
            top: 0,
            right: 0,
            textStyle: {
                fontFamily: 'Vazir, IRANSans, Tahoma',
                fontSize: 12,
                color: '#4b5563'
            },
            icon: 'roundRect',
            itemWidth: 16,
            itemHeight: 8
        },
        
        // Background
        backgroundColor: 'transparent'
    };
    
    // Set option with notMerge to ensure clean update
    chartInstance.setOption(option, true);
    chartInstance.resize();
}
