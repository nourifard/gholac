let funds = [];

let selectedFundIndex = 0;

let selectedPriceType = "صدور";

let chart;



/* =====================================================
   LOAD DATA
===================================================== */

async function loadFunds() {

    try {

        const response =
            await fetch("./funds.json");

        if (!response.ok) {

            throw new Error(
                "خطا در دریافت funds.json"
            );

        }

        const data =
            await response.json();

        funds = data.funds || [];

        if (!funds.length) {

            throw new Error(
                "هیچ صندوقی در funds.json وجود ندارد."
            );

        }


        initializePage();

    }

    catch (error) {

        console.error(error);

        document.getElementById(
            "fundsGrid"
        ).innerHTML = `

            <div class="error-message">

                خطا در دریافت اطلاعات صندوق‌ها

            </div>

        `;

    }

}



/* =====================================================
   INITIALIZE
===================================================== */

function initializePage() {

    renderFundCards();

    renderFundSelector();

    updateChart();

    updateHero();

}



/* =====================================================
   FUND CARDS
===================================================== */

function renderFundCards() {

    const container =
        document.getElementById("fundsGrid");


    container.innerHTML = "";


    funds.forEach((item, index) => {

        const fund =
            item.fund;

        const returns =
            item.returns?.["صدور"];


        const yearly =
            returns?.yearly;


        const card =
            document.createElement("div");


        card.className =
            "fund-card";


        if (index === selectedFundIndex) {

            card.classList.add("active");

        }


        card.innerHTML = `

            <div class="fund-icon">
                ${getFundInitial(fund.name)}
            </div>

            <div class="fund-name">
                ${fund.name}
            </div>

            <div class="fund-english">
                ${fund.english_name || ""}
            </div>

            <div class="fund-return">

                <div class="fund-return-label">
                    بازدهی یک‌ساله
                </div>

                <div class="fund-return-value">

                    ${formatNumber(yearly)}

                    <span>%</span>

                </div>

            </div>

        `;


        card.addEventListener(
            "click",
            () => {

                selectedFundIndex =
                    index;

                updateActiveCards();

                renderFundSelector();

                updateChart();

            }
        );


        container.appendChild(card);

    });

}



/* =====================================================
   FUND SELECTOR
===================================================== */

function renderFundSelector() {

    const container =
        document.getElementById(
            "fundSelector"
        );


    container.innerHTML = "";


    funds.forEach((item, index) => {

        const button =
            document.createElement("button");


        button.className =
            "selector-btn";


        if (
            index === selectedFundIndex
        ) {

            button.classList.add("active");

        }


        button.textContent =
            item.fund.name;


        button.addEventListener(
            "click",
            () => {

                selectedFundIndex =
                    index;

                renderFundSelector();

                updateActiveCards();

                updateChart();

            }
        );


        container.appendChild(button);

    });

}



/* =====================================================
   PRICE TABS
===================================================== */

document
    .querySelectorAll(".price-tab")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(
                        ".price-tab"
                    )
                    .forEach(btn => {

                        btn.classList.remove(
                            "active"
                        );

                    });


                button.classList.add(
                    "active"
                );


                selectedPriceType =
                    button.dataset.type;


                updateChart();

            }
        );

    });



/* =====================================================
   UPDATE CARDS
===================================================== */

function updateActiveCards() {

    document
        .querySelectorAll(".fund-card")
        .forEach((card, index) => {

            card.classList.toggle(
                "active",
                index === selectedFundIndex
            );

        });

}



/* =====================================================
   CHART
===================================================== */

function updateChart() {

    const item =
        funds[selectedFundIndex];


    if (!item) return;


    const fund =
        item.fund;


    const returns =
        item.returns?.[selectedPriceType];


    if (!returns) {

        console.warn(
            `داده ${selectedPriceType} برای ${fund.name} وجود ندارد.`
        );

        return;

    }


    document.getElementById(
        "selectedFundName"
    ).textContent =
        fund.name;


    document.getElementById(
        "selectedFundType"
    ).textContent =
        `بازدهی بر اساس قیمت ${selectedPriceType}`;


    document.getElementById(
        "lastUpdate"
    ).textContent =
        formatDate(item.updated_at);


    const trend =
        returns.daily_trend || [];


    const dates =
        trend.map(item => item.x);


    const values =
        trend.map(item => item.y);


    const chartElement =
        document.getElementById(
            "performanceChart"
        );


    if (!chart) {

        chart =
            echarts.init(chartElement);

    }


    const option = {

        animation: true,

        animationDuration: 1000,

        animationEasing: "cubicOut",


        tooltip: {

            trigger: "axis",

            backgroundColor:
                "#101f32",

            borderColor:
                "rgba(255,255,255,.1)",

            textStyle: {

                color: "#fff",

                fontFamily:
                    "IRANSansX"

            },

            formatter: function(params) {

                if (!params.length)
                    return "";

                const point =
                    params[0];

                return `

                    <div
                        style="
                        font-family:IRANSansX;
                        direction:rtl;
                        "
                    >

                        <b>
                            ${point.axisValue}
                        </b>

                        <br>

                        بازدهی:
                        <strong>
                            ${formatNumber(point.value)}٪
                        </strong>

                    </div>

                `;

            }

        },


        grid: {

            top: 30,

            right: 20,

            left: 20,

            bottom: 60,

            containLabel: true

        },


        xAxis: {

            type: "category",

            data: dates,

            boundaryGap: false,

            axisLine: {

                lineStyle: {

                    color:
                        "rgba(255,255,255,.1)"

                }

            },

            axisLabel: {

                color: "#91a0b5",

                fontFamily:
                    "IRANSansX",

                fontSize: 11,

                formatter: function(value) {

                    return value;

                }

            }

        },


        yAxis: {

            type: "value",

            axisLabel: {

                color: "#91a0b5",

                fontFamily:
                    "IRANSansX",

                formatter: "{value}%"

            },

            splitLine: {

                lineStyle: {

                    color:
                        "rgba(255,255,255,.06)"

                }

            }

        },


        series: [

            {

                name:
                    `بازدهی ${selectedPriceType}`,

                type: "line",

                data: values,

                smooth: true,

                showSymbol: false,

                symbolSize: 7,

                lineStyle: {

                    width: 3

                },

                areaStyle: {

                    opacity: .12

                },

                emphasis: {

                    focus: "series"

                }

            }

        ]

    };


    chart.setOption(
        option,
        true
    );

}



/* =====================================================
   HERO
===================================================== */

function updateHero() {

    let best = null;


    funds.forEach(item => {

        const value =
            item.returns?.["صدور"]?.yearly;


        if (
            typeof value === "number"
        ) {

            if (
                best === null ||
                value > best
            ) {

                best = value;

            }

        }

    });


    document.getElementById(
        "heroBestReturn"
    ).textContent =
        best !== null
            ? formatNumber(best)
            : "--";

}



/* =====================================================
   HELPERS
===================================================== */

function formatNumber(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "--";

    }


    return Number(value)
        .toLocaleString("fa-IR", {
            maximumFractionDigits: 2
        });

}



function formatDate(value) {

    if (!value) return "--";

    try {

        return new Date(value)
            .toLocaleString("fa-IR");

    }

    catch {

        return value;

    }

}



function getFundInitial(name) {

    if (!name) return "ص";

    return name.replace(
        "صندوق ",
        ""
    ).substring(0, 1);

}



/* =====================================================
   RESPONSIVE CHART
===================================================== */

window.addEventListener(
    "resize",
    () => {

        if (chart) {

            chart.resize();

        }

    }
);



/* =====================================================
   START
===================================================== */

loadFunds();
