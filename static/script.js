document.addEventListener("DOMContentLoaded", function () {
	const variablesTableBody = document.querySelector("#variablesTable tbody");
	const fFunctionsTableBody = document.querySelector("#fFunctionsTable tbody");
	const zFunctionsTableBody = document.querySelector("#zFunctionsTable tbody");
	const loaderContainer = document.getElementById("loaderContainer"); // Новый элемент
	const fillRandomVariablesButton = document.getElementById(
		"fillRandomVariablesButton"
	);
	const radarContainer = document.getElementById("radarChartsContainer");
	const fillRandomFButton = document.getElementById("fillRandomFButton");
	const fillRandomZButton = document.getElementById("fillRandomZButton");

	const calculateButton = document.getElementById("calculateButton");
	const saveJsonButton = document.getElementById("saveJsonButton");
	const loadJsonButton = document.getElementById("loadJsonButton");
	const fillRandomButton = document.getElementById("fillRandomButton");

	const resultsArea = document.getElementById("resultsArea");
	const statusMessageEl = document.getElementById("statusMessage");
	const mainPlotImg = document.getElementById("mainPlot");
	const coeffsInfoEl = document.getElementById("coeffsInfo");

	const DEFAULT_COEFF_VALUE = 0; // Для полиномов
	const DEFAULT_L_START_VALUE = 0.1;

	// --- Функции для управления состоянием загрузки ---
	function showLoader() {
		if (loaderContainer) loaderContainer.style.display = "flex";
		if (calculateButton) {
			calculateButton.disabled = true;
			calculateButton.textContent = "Расчет...";
		}
		// Блокируем кнопки заполнения
		[fillRandomVariablesButton, fillRandomFButton, fillRandomZButton].forEach(
			button => {
				if (button) button.disabled = true;
			}
		);

		// Очистка и скрытие предыдущих результатов
		resultsArea.style.display = "block"; // Показываем блок результатов, чтобы было видно статус/лоадер
		mainPlotImg.style.display = "none";
		if (radarContainer) radarContainer.innerHTML = "";
		coeffsInfoEl.textContent = "";
		statusMessageEl.textContent =
			"Выполняется расчет... Пожалуйста, подождите."; // Начальное сообщение статуса
		statusMessageEl.className = "status";
	}

	function hideLoader(isError = false) {
		if (loaderContainer) loaderContainer.style.display = "none";
		if (calculateButton) {
			calculateButton.disabled = false;
			calculateButton.textContent = "Рассчитать";
		}
		// Разблокируем кнопки заполнения
		[fillRandomVariablesButton, fillRandomFButton, fillRandomZButton].forEach(
			button => {
				if (button) button.disabled = false;
			}
		);

		// Если не было ошибки, resultsArea уже отображается (из showLoader).
		// Если была ошибка, то resultsArea тоже отображается, но с сообщением об ошибке.
		// Так что дополнительно управлять display для resultsArea здесь не обязательно.
	}

	function fillRandomVariables() {
		for (let i = 0; i < NUM_L_VARIABLES; i++) {
			const startInputEl = document.getElementById(`l_start_${i}`);
			const limitInputEl = document.getElementById(`l_limit_${i}`); // Если нужно заполнять
			const minInputEl = document.getElementById(`l_min_${i}`); // Если нужно заполнять

			if (startInputEl) {
				startInputEl.value = (Math.random() * 0.8 + 0.1).toFixed(2); // Диапазон 0.1 - 0.9
			}
			if (limitInputEl) {
				// Пример заполнения, можно настроить логику
				let startVal = startInputEl ? parseFloat(startInputEl.value) : 0.5;
				limitInputEl.value = (
					startVal +
					Math.random() * (1 - startVal)
				).toFixed(2); // Больше startVal, но <= 1
			}
			if (minInputEl) {
				// Пример
				let startVal = startInputEl ? parseFloat(startInputEl.value) : 0.5;
				minInputEl.value = (Math.random() * startVal).toFixed(2); // Меньше startVal, но >= 0
			}
		}
		console.log("Переменные L_i заполнены случайными значениями.");
		// Можно добавить сообщение для пользователя, если statusMessageEl доступен и это нужно
		// statusMessageEl.textContent = "Параметры модели L_i заполнены случайными значениями.";
		// statusMessageEl.className = "status success";
		// resultsArea.style.display = "block"; // Возможно, не нужно показывать результаты сразу
	}

	function fillRandomFCoeffs() {
		// Диапазоны для коэффициентов f_i
		// Можно сделать их настраиваемыми или взять из полей "Параметры Проверки и Генерации", если это уместно
		const coeffMin =
			parseFloat(document.getElementById("internal_coeff_min_random").value) ||
			-0.5;
		const coeffMax =
			parseFloat(document.getElementById("internal_coeff_max_random").value) ||
			0.5;

		for (let i = 0; i < NUM_F_FUNCTIONS; i++) {
			for (let j = 3; j >= 0; j--) {
				// c3, c2, c1, c0
				const inputEl = document.getElementById(`f_coeff_${i}_c${j}`);
				if (inputEl) {
					inputEl.value = (
						Math.random() * (coeffMax - coeffMin) +
						coeffMin
					).toFixed(2); // 2 знака после запятой
				}
			}
		}
		console.log("Коэффициенты функций f_i заполнены случайными значениями.");
	}

	function fillRandomZCoeffs() {
		// Диапазоны для коэффициентов z_i (могут отличаться от f_i)
		const coeffMin = -0.3; // Пример
		const coeffMax = 0.3; // Пример

		for (let i = 0; i < NUM_Z_FUNCTIONS; i++) {
			for (let j = 3; j >= 0; j--) {
				// c3, c2, c1, c0
				const inputEl = document.getElementById(`z_coeff_${i}_c${j}`);
				if (inputEl) {
					inputEl.value = (
						Math.random() * (coeffMax - coeffMin) +
						coeffMin
					).toFixed(2);
				}
			}
		}
		console.log("Коэффициенты функций z_i заполнены случайными значениями.");
	}

	if (fillRandomVariablesButton) {
		fillRandomVariablesButton.addEventListener("click", function () {
			fillRandomVariables();
			// Опционально: обновить сообщение для пользователя
			statusMessageEl.textContent =
				"Параметры модели L_i заполнены случайными значениями.";
			statusMessageEl.className = "status success"; // Используйте ваш класс для успеха
			resultsArea.style.display = "block"; // Показать секцию результатов, чтобы было видно сообщение
			mainPlotImg.style.display = "none"; // Скрыть предыдущие графики
			coeffsInfoEl.textContent = ""; // Очистить инфо о коэффициентах
			const radarContainer = document.getElementById("radarChartsContainer");
			if (radarContainer) radarContainer.innerHTML = "";
		});
	}

	if (fillRandomFButton) {
		fillRandomFButton.addEventListener("click", function () {
			fillRandomFCoeffs();
			statusMessageEl.textContent =
				"Внутренние функции f_i заполнены случайными значениями.";
			statusMessageEl.className = "status success";
			resultsArea.style.display = "block";
			mainPlotImg.style.display = "none";
			coeffsInfoEl.textContent = "";
			const radarContainer = document.getElementById("radarChartsContainer");
			if (radarContainer) radarContainer.innerHTML = "";
		});
	}

	if (fillRandomZButton) {
		fillRandomZButton.addEventListener("click", function () {
			fillRandomZCoeffs();
			statusMessageEl.textContent =
				"Внешние факторы z_i заполнены случайными значениями.";
			statusMessageEl.className = "status success";
			resultsArea.style.display = "block";
			mainPlotImg.style.display = "none";
			coeffsInfoEl.textContent = "";
			const radarContainer = document.getElementById("radarChartsContainer");
			if (radarContainer) radarContainer.innerHTML = "";
		});
	}

	// --- Генерация таблиц ---
	function createInputField(
		type,
		id,
		value,
		step = "0.01",
		className = "table-input"
	) {
		const input = document.createElement("input");
		input.type = type;
		input.id = id;
		input.className = className;
		input.value = value;
		if (type === "number") input.step = step;
		return input;
	}

	// Генерация таблицы переменных L_i
	function populateVariablesTable() {
		if (!variablesTableBody) return;
		for (let i = 0; i < NUM_L_VARIABLES; i++) {
			const row = variablesTableBody.insertRow();
			const cellName = row.insertCell();
			cellName.textContent = L_VARIABLE_NAMES[i] || `L${i + 1}`;

			const cellStart = row.insertCell();
			cellStart.appendChild(
				createInputField("number", `l_start_${i}`, DEFAULT_L_START_VALUE)
			);

			// Заглушки для предельного и минимального, т.к. не используются в расчете
			const cellLimit = row.insertCell();
			cellLimit.appendChild(
				createInputField("number", `l_limit_${i}`, DEFAULT_L_START_VALUE + 0.2)
			);
			const cellMin = row.insertCell();
			cellMin.appendChild(createInputField("number", `l_min_${i}`, 0));
		}
	}

	// Генерация таблиц функций f_i и z_i
	function populateFunctionsTable(tableBody, prefix, numFunctions) {
		if (!tableBody) return;
		for (let i = 0; i < numFunctions; i++) {
			const row = tableBody.insertRow();
			const cellName = row.insertCell();
			cellName.innerHTML = `${prefix}<sub>${i + 1}</sub> =`;

			// Коэффициенты c3, c2, c1, c0
			for (let j = 3; j >= 0; j--) {
				// c3, c2, c1, c0
				const cellCoeff = row.insertCell();
				// ID: f_coeff_0_c3 (для f1, коэф. при x^3)
				// ID: z_coeff_0_c3 (для z1, коэф. при t^3)
				cellCoeff.appendChild(
					createInputField(
						"number",
						`${prefix}_coeff_${i}_c${j}`,
						DEFAULT_COEFF_VALUE
					)
				);
			}
		}
	}

	populateVariablesTable();
	populateFunctionsTable(fFunctionsTableBody, "f", NUM_F_FUNCTIONS);
	populateFunctionsTable(zFunctionsTableBody, "z", NUM_Z_FUNCTIONS);

	// --- Сбор данных ---
	function getTableData(numRows, prefix, numCoeffsPerPoly) {
		const dataArray = [];
		for (let i = 0; i < numRows; i++) {
			const polyCoeffs = [];
			for (let j = 0; j < numCoeffsPerPoly; j++) {
				// Собираем в порядке c0, c1, c2, c3
				const coeff_c_index = numCoeffsPerPoly - 1 - j; // для 4 коэф: c3,c2,c1,c0 -> j=0 (c3), j=1 (c2)..
				// нам нужен порядок c0, c1, c2, c3 для Polynomial класса
				const inputId = `${prefix}_coeff_${i}_c${j}`; // Собираем в порядке c3, c2, c1, c0
				const inputEl = document.getElementById(inputId);
				polyCoeffs.push(inputEl ? parseFloat(inputEl.value) || 0 : 0);
			}
			dataArray.push(polyCoeffs.reverse()); // Переворачиваем, чтобы было [c0, c1, c2, c3]
		}
		return dataArray;
	}

	// --- Обработчики кнопок ---
	if (calculateButton) {
		calculateButton.addEventListener("click", async function () {
			showLoader(); // Показываем лоадер и блокируем кнопки

			const start_conditions = [];
			for (let i = 0; i < NUM_L_VARIABLES; i++) {
				const inputEl = document.getElementById(`l_start_${i}`);
				start_conditions.push(
					inputEl ? parseFloat(inputEl.value) || 0 : DEFAULT_L_START_VALUE
				);
			}

			const numCoeffsPerPoly = 4;
			const f_coeffs = getTableData(NUM_F_FUNCTIONS, "f", numCoeffsPerPoly);
			const z_coeffs = getTableData(NUM_Z_FUNCTIONS, "z", numCoeffsPerPoly);

			const l_limits_payload = [];
			for (let i = 0; i < NUM_L_VARIABLES; i++) {
				const limitInputEl = document.getElementById(`l_limit_${i}`);
				l_limits_payload.push(
					limitInputEl ? parseFloat(limitInputEl.value) || 1.0 : 1.0
				);
			}

			const payload = {
				start_conditions: start_conditions,
				initial_f_coeffs: f_coeffs,
				z_coeffs: z_coeffs,
				l_limits: l_limits_payload,
				poly_output_lower_bound: parseFloat(
					document.getElementById("poly_output_lower_bound").value
				),
				max_iterations_coeff_search: parseInt(
					document.getElementById("max_iterations_coeff_search").value
				),
				internal_coeff_min_random: parseFloat(
					document.getElementById("internal_coeff_min_random").value
				),
				internal_coeff_max_random: parseFloat(
					document.getElementById("internal_coeff_max_random").value
				),
				internal_poly_check_range_min: parseFloat(
					document.getElementById("internal_poly_check_range_min").value
				),
				internal_poly_check_range_max: parseFloat(
					document.getElementById("internal_poly_check_range_max").value
				),
				internal_poly_check_granularity: parseInt(
					document.getElementById("internal_poly_check_granularity").value
				),
			};

			try {
				const response = await fetch("/calculate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				const result = await response.json();

				if (response.ok) {
					// statusMessageEl и resultsArea уже настроены в showLoader,
					// здесь только обновляем контент и класс статуса
					statusMessageEl.textContent = result.message || "Расчет завершен!";
					statusMessageEl.className = "status success";

					if (result.main_plot_url) {
						mainPlotImg.src =
							result.main_plot_url + "?t=" + new Date().getTime();
						mainPlotImg.style.display = "block";
					}
					if (result.radar_plot_urls && radarContainer) {
						// Проверяем radarContainer
						radarContainer.innerHTML = ""; // Очищаем перед добавлением новых
						result.radar_plot_urls.forEach(radarUrl => {
							const img = document.createElement("img");
							img.src = radarUrl + "?t=" + new Date().getTime();
							img.alt = "Лепестковая диаграмма";
							radarContainer.appendChild(img);
						});
					}
					if (result.final_f_coeffs_snippet) {
						// Изменено имя поля
						coeffsInfoEl.innerHTML = `<b>Пример финальных коэффициентов для первых 5 внутренних полиномов (f_i):</b><br> ${JSON.stringify(
							result.final_f_coeffs_snippet
						)}`;
					}
				} else {
					statusMessageEl.textContent =
						"Ошибка сервера: " +
						(result.error || response.statusText || "Неизвестная ошибка");
					statusMessageEl.className = "status error";
				}
			} catch (error) {
				statusMessageEl.textContent =
					"Сетевая ошибка или ошибка клиента: " + error.message;
				statusMessageEl.className = "status error";
				console.error("Fetch error:", error);
			} finally {
				hideLoader();
			}
		});
	}

	if (fillRandomButton) {
		fillRandomButton.addEventListener("click", function () {
			// 1. Заполнение начальных условий L_i (оставляем как есть или корректируем диапазон)
			for (let i = 0; i < NUM_L_VARIABLES; i++) {
				const inputEl = document.getElementById(`l_start_${i}`);
				if (inputEl) {
					inputEl.value = (Math.random() * 0.9 + 0.05).toFixed(2);
				}
				// ... (остальные поля L_i) ...
			}

			// 2. Заполнение коэффициентов полиномов f_i
			// ВАЖНО: Для теста с одним полиномом и положительными коэффициентами:
			const f_coeffMin_frontend_test = 0.1; // Как мы задали для серверной генерации в тесте
			const f_coeffMax_frontend_test = 0.5; // Как мы задали для серверной генерации в тесте

			// Если NUM_F_FUNCTIONS === 1 (наш текущий тест), используем эти диапазоны.
			// Иначе, можно использовать более общие, как было раньше.
			const current_f_coeffMin =
				NUM_F_FUNCTIONS === 1 ? f_coeffMin_frontend_test : -0.5; // Старый общий диапазон -0.5
			const current_f_coeffMax =
				NUM_F_FUNCTIONS === 1 ? f_coeffMax_frontend_test : 0.5; // Старый общий диапазон 0.5

			for (let i = 0; i < NUM_F_FUNCTIONS; i++) {
				for (let j = 3; j >= 0; j--) {
					// c3, c2, c1, c0
					const inputEl = document.getElementById(`f_coeff_${i}_c${j}`);
					if (inputEl) {
						inputEl.value = (
							Math.random() * (current_f_coeffMax - current_f_coeffMin) +
							current_f_coeffMin
						).toFixed(2);
					}
				}
			}

			// 3. Заполнение коэффициентов полиномов z_i (можно оставить старый диапазон или тоже сделать положительным для теста)
			const z_coeffMin = -0.5;
			const z_coeffMax = 0.5;
			for (let i = 0; i < NUM_Z_FUNCTIONS; i++) {
				for (let j = 3; j >= 0; j--) {
					// c3, c2, c1, c0
					const inputEl = document.getElementById(`z_coeff_${i}_c${j}`);
					if (inputEl) {
						inputEl.value = (
							Math.random() * (z_coeffMax - z_coeffMin) +
							z_coeffMin
						).toFixed(2);
					}
				}
			}

			statusMessageEl.textContent = "Поля заполнены случайными значениями.";
			statusMessageEl.className = "status success";
			resultsArea.style.display = "block";
			mainPlotImg.style.display = "none";
			coeffsInfoEl.textContent = "";
		});
	}

	// Заглушки для остальных кнопок
	[saveJsonButton, loadJsonButton].forEach(button => {
		if (button && !button.getAttribute("listener")) {
			// Проверяем, не добавлен ли уже слушатель
			button.addEventListener("click", function () {
				alert(`Кнопка "${this.textContent}" еще не реализована.`);
			});
			button.setAttribute("listener", "true");
		}
	});
});
