import matplotlib

matplotlib.use("Agg")  # Важно для работы Matplotlib в Flask без GUI
import matplotlib.pyplot as plt
from matplotlib import cm
import numpy as np
from scipy.integrate import odeint
from flask import Flask, request, jsonify, render_template, url_for
from flask_cors import CORS
import random
import os
import time

from polynoms import Polynomial  # Импортируем наш класс

VARIABLES_DESCRIPTION = {
    str(i + 1): {"variable_name": f"L{i + 1}", "variable_title": f"Параметр L{i + 1}"}
    for i in range(14)
}
NUM_INTERNAL_POLYNOMIALS = (
    151  # Столько используется в dL_dx (functions[0]...functions[150])
)
NUM_EXTERNAL_Q_POLYNOMIALS = 5  # e1...e5, которые зависят от data["q"]

# Глобальные переменные для имен L_i, если они нужны в _save_main_plot
# Если они определены в JS, то в Python их нужно либо дублировать, либо передавать с клиента
L_VARIABLE_NAMES = [  # Дублируем из JS для использования в легенде графика
    "Скорость развертывания новых версий (Deployment Velocity)",
    "Время восстановления после сбоя (Mean Time to Recovery - MTTR)",
    "Уровень удовлетворенности пользователей (User Satisfaction Score)",
    "Покрытие кода тестами (Test Coverage Percentage)",
    "Количество критических уязвимостей (Critical Vulnerabilities Count)",
    "Производительность под нагрузкой (Performance Under Load)",
    "Масштабируемость системы (System Scalability)",
    "Качество документации (Documentation Quality Score)",
    "Простота интеграции с другими системами (Integration Simplicity)",
    "Стоимость владения (Total Cost of Ownership - TCO)",
    "Адаптивность к изменениям требований (Change Adaptability)",
    "Уровень технического долга (Technical Debt Level)",
    "Вовлеченность команды разработки (Developer Team Engagement)",
    "Инновационный потенциал продукта (Product Innovation Potential)",
]


# --- Класс для расчетов и отрисовки ---
class CalculationService:
    def __init__(self):
        self.internal_functions = []  # Для f_i(L_j_t)
        # Внешние полиномы e_i(t) будут создаваться на лету в __describe_difference_equations
        # из коэффициентов q_coeffs

    def _init_polynomial_objects(self, list_of_coeffs_lists):
        """Инициализирует список объектов Polynomial из списка списков коэффициентов."""
        return [Polynomial(*coeffs) for coeffs in list_of_coeffs_lists]

    def _check_polynomial_set_values(
        self, poly_objects_list, lower_bound, check_input_range
    ):
        print(
            f"--- Checking {len(poly_objects_list)} polynomials. Lower bound: {lower_bound}. Input range: {check_input_range[0]} to {check_input_range[-1]} ({len(check_input_range)} points) ---"
        )
        for i, poly in enumerate(poly_objects_list):
            for x_val in check_input_range:
                poly_val = poly.calc(x_val)
                if poly_val < lower_bound:
                    print(
                        f"  !!! Poly {i} (coeffs: {poly.coefficients}) FAILED: calc({x_val:.3f}) = {poly_val:.3f} < {lower_bound:.3f}"
                    )
                    return False
            print(f"  Poly {i} (coeffs: {poly.coefficients}) PASSED.")  # ДОБАВЛЕНО
        print("--- All polynomials in set PASSED check. ---")  # ДОБАВЛЕНО
        return True

    def _generate_random_coeffs_for_set(
        self, num_polys, num_coeffs_per_poly, coeff_min, coeff_max
    ):
        """Генерирует случайные коэффициенты для набора полиномов."""
        return [
            [random.uniform(coeff_min, coeff_max) for _ in range(num_coeffs_per_poly)]
            for _ in range(num_polys)
        ]

    def calculate_and_draw(self, params: dict):
        start_conditions = np.array(params["start_conditions"])

        initial_f_coeffs = params["initial_f_coeffs"]  # Коэфф. f_i от пользователя
        z_coeffs_for_e = params[
            "z_coeffs"
        ]  # Коэфф. z_i от пользователя (это бывшие q_coeffs)

        poly_output_lower_bound = params["poly_output_lower_bound"]
        max_iterations_coeff_search = params["max_iterations_coeff_search"]
        internal_coeff_min_random = params["internal_coeff_min_random"]
        internal_coeff_max_random = params["internal_coeff_max_random"]

        check_input_range = np.linspace(
            params.get("internal_poly_check_range_min", 0.0),
            params.get("internal_poly_check_range_max", 1.0),
            params.get("internal_poly_check_granularity", 10),
        )

        # 1. Проверяем пользовательские коэффициенты для f_i
        user_f_poly_objects = self._init_polynomial_objects(initial_f_coeffs)
        final_f_coeffs_to_use = (
            initial_f_coeffs  # По умолчанию используем пользовательские
        )

        if self._check_polynomial_set_values(
            user_f_poly_objects, poly_output_lower_bound, check_input_range
        ):
            self.internal_functions = user_f_poly_objects
            final_f_coeffs_to_use = (
                initial_f_coeffs  # Сохраняем для возврата, если они используются
            )
            print("User-provided internal coefficients are VALID and will be used.")
            self.user_internal_polys_were_used = True
        else:
            print(
                f"User-provided f_coeffs NOT valid. Starting random search for {NUM_INTERNAL_POLYNOMIALS} polys."
            )
            print(
                f"  Random coeff range for f_i: {internal_coeff_min_random} to {internal_coeff_max_random}"
            )
            print(f"  f_i poly output lower bound: {poly_output_lower_bound}")
            print(
                f"  Check input range for f_i: {check_input_range[0]:.2f} to {check_input_range[-1]:.2f} with {len(check_input_range)} points."
            )
            found_valid_random_coeffs = False
            # Полиномы f_i всегда 3-й степени, т.е. 4 коэффициента
            num_coeffs_per_internal_poly = 4  # c0, c1, c2, c3

            for attempt in range(max_iterations_coeff_search):
                current_random_f_coeffs = self._generate_random_coeffs_for_set(
                    NUM_INTERNAL_POLYNOMIALS,
                    num_coeffs_per_internal_poly,
                    internal_coeff_min_random,
                    internal_coeff_max_random,
                )
                temp_random_poly_objects = self._init_polynomial_objects(
                    current_random_f_coeffs
                )

                if self._check_polynomial_set_values(
                    temp_random_poly_objects, poly_output_lower_bound, check_input_range
                ):
                    self.internal_functions = temp_random_poly_objects
                    final_f_coeffs_to_use = current_random_f_coeffs
                    found_valid_random_coeffs = True
                    print(
                        f"Found valid random internal coefficients at attempt {attempt + 1}."
                    )
                    break
                if (attempt + 1) % 100 == 0:
                    print(
                        f"Random search attempt {attempt + 1}/{max_iterations_coeff_search}..."
                    )

            if not found_valid_random_coeffs:
                raise ValueError(
                    f"Не удалось найти/сгенерировать подходящие коэффициенты для внутренних полиномов f_i за {max_iterations_coeff_search} попыток."
                )

        X_ode = np.linspace(0, 1, 50)
        Y_solution = odeint(
            self._solve_differential_equations,
            start_conditions,
            X_ode,
            args=(z_coeffs_for_e,),  # Передаем коэффициенты для z_i(t)
        )

        # Убедись, что папка static/images существует
        static_images_dir = os.path.join(
            app.root_path, "static", "images"
        )  # app.root_path это путь к папке с app.py
        if not os.path.exists(static_images_dir):
            os.makedirs(static_images_dir)

        timestamp = int(time.time())
        # Путь для сохранения файла относительно корня проекта
        plot_filename = f"plot_main_{timestamp}.png"
        plot_save_path = os.path.join(static_images_dir, plot_filename)
        self._save_main_plot(X_ode, Y_solution, plot_save_path)

        # URL, который будет использоваться на клиенте
        # Он будет указывать на эндпоинт Flask для статических файлов
        plot_url_for_client = url_for("static", filename=f"images/{plot_filename}")

        radar_plot_urls = []
        num_L_variables = Y_solution.shape[1]

        short_radar_labels = [f"x{i + 1}" for i in range(num_L_variables)]

        # Используем L_VARIABLE_NAMES_SERVER для меток
        radar_labels = L_VARIABLE_NAMES[
            :num_L_variables
        ]  # Обрезаем, если переменных меньше

        # Границы нормы для радаров - предполагаем, что они могут прийти с клиента
        # В твоем HTML для "Кода 2" нет полей для "предельных значений" как в "Коде 1"
        # Если хочешь рисовать линию границ, эти данные нужно как-то получить
        # Например, из params["variable_limits"] или params["radar_max_values"]
        # Для примера, пока поставим None
        radar_max_values = params.get(
            "variable_limits", None
        )  # Ожидаем, что это список/массив
        # из params, переданных из handle_calculate

        time_slices_indices = [0, 4, 8, 12, 16, 20]  # t=0, 0.2, 0.4, 0.6, 0.8, 1.0

        for i, sol_index in enumerate(time_slices_indices):
            if sol_index < len(X_ode) and sol_index < len(Y_solution):
                data_slice = Y_solution[sol_index, :]
                slice_time = X_ode[sol_index]
                radar_title = f"Срез L_i при t={slice_time:.1f}"

                radar_filename = f"radar_plot_{i}_{timestamp}.png"
                radar_save_path = os.path.join(static_images_dir, radar_filename)

                current_radar_max_values = None
                if radar_max_values and len(radar_max_values) == num_L_variables:
                    current_radar_max_values = np.array(radar_max_values)

                self._save_radar_plot(
                    data_slice,
                    short_radar_labels,
                    current_radar_max_values,
                    radar_title,
                    radar_save_path,
                )
                radar_plot_urls.append(
                    url_for("static", filename=f"images/{radar_filename}")
                )

        return {
            "main_plot_url": plot_url_for_client,
            "radar_plot_urls": radar_plot_urls,
            "message": "Расчет успешно завершен.",
            "final_f_coeffs_snippet": [coeffs for coeffs in final_f_coeffs_to_use[:5]],
        }

    def _save_radar_plot(
        self, data_slice, labels, max_values_for_plot, title, save_path
    ):
        num_vars = len(labels)
        angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
        data_slice_closed = np.concatenate((data_slice, [data_slice[0]]))
        angles_closed = angles + [angles[0]]

        max_values_closed = None
        if max_values_for_plot is not None:
            if not isinstance(max_values_for_plot, np.ndarray):
                max_values_for_plot = np.array(max_values_for_plot)
            if len(max_values_for_plot) == num_vars:
                max_values_closed = np.concatenate(
                    (max_values_for_plot, [max_values_for_plot[0]])
                )
            else:
                print(
                    f"Radar Plot Warning: Length of max_values ({len(max_values_for_plot)}) != num_vars ({num_vars}). Not drawing max_values line."
                )
                max_values_for_plot = None

        # --- ИСПРАВЛЕНИЯ ЦВЕТОВ НАЧИНАЮТСЯ ЗДЕСЬ ---
        # Определим цвета, которые Matplotlib понимает
        primary_plot_color = "#3B82F6"  # Синий (из твоего CSS var(--primary-color))
        primary_fill_color = "#3B82F6"  # Тот же синий для заливки
        norm_line_color = (
            "#EF4444"  # Красный (из твоего CSS var(--error-color) для контраста)
        )

        # Цвета для фона и текста (если хочешь темную тему для сохраненных картинок)
        # Для простоты пока оставим стандартный фон matplotlib (обычно белый)
        # Но если нужно, можно установить:
        # fig_face_color = '#374151' # var(--card-bg-color)
        # ax_face_color = '#374151'  # var(--card-bg-color)
        # text_color = '#F3F4F6'     # var(--text-color)
        # muted_text_color = '#9CA3AF'# var(--muted-text-color)
        # border_color = '#4B5563'   # var(--border-color)

        fig, ax = plt.subplots(figsize=(6, 6), subplot_kw=dict(polar=True))

        # Если хочешь темный фон для картинки:
        # fig.patch.set_facecolor(fig_face_color)
        # ax.set_facecolor(ax_face_color)

        ax.plot(
            angles_closed,
            data_slice_closed,
            "o-",
            linewidth=1.5,
            color=primary_plot_color,
            label="Текущие значения",
        )
        ax.fill(angles_closed, data_slice_closed, color=primary_fill_color, alpha=0.25)

        if max_values_closed is not None:
            ax.plot(
                angles_closed,
                max_values_closed,
                "-",
                linewidth=1,
                color=norm_line_color,
                label="Границы нормы",
            )
            # ax.fill(angles_closed, max_values_closed, color=norm_line_color, alpha=0.1) # Можно добавить заливку для границ

        ax.set_xticks(angles)
        ax.set_xticklabels(
            labels, fontsize=7
        )  # , color=text_color если используешь темный фон)

        ax.set_yticks(np.arange(0, 1.01, 0.25))  # Деления до 1.0 включительно
        ax.set_yticklabels(
            [f"{tick:.2f}" for tick in np.arange(0, 1.01, 0.25)], fontsize=7
        )  # , color=muted_text_color)
        ax.set_ylim(0, 1.05)

        ax.set_title(title, va="bottom", fontsize=10, y=1.1)  # , color=text_color)
        ax.legend(
            loc="lower center", bbox_to_anchor=(0.5, -0.25), ncol=2, fontsize=8
        )  # Легенда под графиком

        # Стилизация осей и сетки для темного фона (если используется)
        # ax.tick_params(colors=muted_text_color)
        # ax.spines['polar'].set_edgecolor(border_color)
        ax.yaxis.grid(
            True, linestyle="--", linewidth=0.5, alpha=0.7
        )  # , color=border_color)
        ax.xaxis.grid(
            True, linestyle="--", linewidth=0.5, alpha=0.7
        )  # , color=border_color)

        plt.tight_layout()
        # Если устанавливал fig_face_color, используй его при сохранении:
        # plt.savefig(save_path, facecolor=fig.get_facecolor())
        plt.savefig(
            save_path
        )  # Сохраняем со стандартным фоном (обычно белый или прозрачный)
        plt.clf()
        plt.close(fig)
        print(f"Radar plot saved to {save_path}")

    def _solve_differential_equations(self, u_state, t, z_coeffs_for_e_functions):
        # ... (логика решения ДУ как раньше, но q_coeffs_for_e_functions теперь z_coeffs_for_e_functions)
        # e = [Polynomial(*zc).calc(t) for zc in z_coeffs_for_e_functions]
        # ... остальное без изменений ...
        L = u_state
        e = [
            Polynomial(*zc).calc(t) for zc in z_coeffs_for_e_functions
        ]  # z_coeffs -> e_i(t)
        f = self.internal_functions
        dL = [0.0] * 14
        # ... (тело уравнений без изменений, предполагая, что f и e используются корректно) ...
        try:
            dL[0] = (
                1
                / 15
                * (
                    f[0].calc(L[0])
                    * f[1].calc(L[1])
                    * f[2].calc(L[2])
                    * f[3].calc(L[3])
                    * f[4].calc(L[4])
                    * f[5].calc(L[5])
                    * f[6].calc(L[6])
                    * f[7].calc(L[7])
                    * f[8].calc(L[8])
                    * f[9].calc(L[9])
                    * f[10].calc(L[10])
                    * f[11].calc(L[11])
                    * f[12].calc(L[12])
                    * f[13].calc(L[13])
                    * (e[0] + e[1] + e[2])
                    - e[3]
                    - e[4]
                )
            )
            dL[1] = (
                1
                / 15
                * (
                    f[14].calc(L[0])
                    * f[15].calc(L[1])
                    * f[16].calc(L[2])
                    * f[17].calc(L[3])
                    * f[18].calc(L[4])
                    * f[19].calc(L[5])
                    * f[20].calc(L[6])
                    * f[21].calc(L[7])
                    * f[22].calc(L[8])
                    * f[23].calc(L[9])
                    * f[24].calc(L[10])
                    * f[25].calc(L[11])
                    * f[26].calc(L[12])
                    * f[27].calc(L[13])
                    * (e[0] + e[1] + e[2] + e[3])
                    - e[4]
                )
            )
            dL[2] = (
                1
                / 15
                * (
                    f[28].calc(L[0])
                    * f[29].calc(L[1])
                    * f[30].calc(L[2])
                    * f[31].calc(L[3])
                    * f[32].calc(L[4])
                    * f[33].calc(L[5])
                    * f[34].calc(L[6])
                    * f[35].calc(L[7])
                    * f[36].calc(L[8])
                    * f[37].calc(L[9])
                    * f[38].calc(L[10])
                    * f[39].calc(L[11])
                    * f[40].calc(L[12])
                    * f[41].calc(L[13])
                    * (e[0] + e[1] + e[2] + e[3])
                    - e[4]
                )
            )
            dL[3] = (
                1
                / 15
                * (
                    f[42].calc(L[0])
                    * f[43].calc(L[1])
                    * f[44].calc(L[2])
                    * f[45].calc(L[3])
                    * f[48].calc(L[6])
                    * f[49].calc(L[7])
                    * f[50].calc(L[8])
                    * f[51].calc(L[9])
                    * f[52].calc(L[10])
                    * f[53].calc(L[11])
                    * f[54].calc(L[12])
                    * f[55].calc(L[13])
                    * e[4]
                    - (e[0] + e[1] + e[2] + e[3] + f[46].calc(L[6]) * f[47].calc(L[7]))
                )
            )
            dL[4] = (
                1
                / 15
                * (
                    f[56].calc(L[3])
                    * f[57].calc(L[5])
                    * f[58].calc(L[8])
                    * f[59].calc(L[9])
                    * f[60].calc(L[12])
                    * (e[0] + e[1] + e[3] + e[4])
                    - e[4]
                )
            )
            dL[5] = (
                1
                / 15
                * (
                    f[61].calc(L[0])
                    * f[62].calc(L[1])
                    * f[63].calc(L[2])
                    * f[64].calc(L[3])
                    * f[65].calc(L[4])
                    * f[66].calc(L[5])
                    * f[67].calc(L[6])
                    * f[68].calc(L[7])
                    * f[69].calc(L[8])
                    * f[70].calc(L[9])
                    * f[71].calc(L[10])
                    * f[72].calc(L[11])
                    * f[73].calc(L[12])
                    * f[74].calc(L[13])
                    * (e[0] + e[1])
                    - e[4]
                )
            )
            dL[6] = (
                1
                / 15
                * (f[46].calc(L[1]) * f[47].calc(L[3]) * f[150].calc(L[13]) - e[4])
            )
            dL[7] = (
                1
                / 15
                * (
                    f[75].calc(L[0])
                    * f[76].calc(L[1])
                    * f[77].calc(L[2])
                    * f[78].calc(L[3])
                    * f[79].calc(L[5])
                    * f[80].calc(L[8])
                    * f[81].calc(L[9])
                    * (e[0] + e[1] + e[2])
                    - e[0]
                    - e[1]
                )
            )
            dL[8] = (
                1
                / 15
                * (
                    f[82].calc(L[0])
                    * f[83].calc(L[1])
                    * f[84].calc(L[2])
                    * f[85].calc(L[3])
                    * f[86].calc(L[4])
                    * f[87].calc(L[5])
                    * f[88].calc(L[6])
                    * f[89].calc(L[9])
                    * f[90].calc(L[10])
                    * f[91].calc(L[11])
                    * f[92].calc(L[12])
                    * f[93].calc(L[13])
                    * (e[3] + e[4])
                    - e[0]
                    - e[1]
                    - e[2]
                )
            )
            dL[9] = (
                1
                / 15
                * (
                    f[94].calc(L[0])
                    * f[95].calc(L[1])
                    * f[96].calc(L[2])
                    * f[97].calc(L[3])
                    * f[98].calc(L[4])
                    * f[99].calc(L[5])
                    * f[100].calc(L[6])
                    * f[101].calc(L[7])
                    * f[102].calc(L[8])
                    * f[103].calc(L[9])
                    * f[104].calc(L[10])
                    * f[105].calc(L[11])
                    * (e[0] + e[1])
                    - f[106].calc(L[12]) * f[107].calc(L[13]) * e[2]
                )
            )
            dL[10] = (
                1
                / 15
                * (
                    f[108].calc(L[0])
                    * f[109].calc(L[1])
                    * f[110].calc(L[2])
                    * f[111].calc(L[3])
                    * f[112].calc(L[7])
                    * f[113].calc(L[9])
                    * f[114].calc(L[11])
                    * f[115].calc(L[12])
                    * f[116].calc(L[13])
                    - f[117].calc(L[4])
                    * f[118].calc(L[5])
                    * (e[0] + e[1] + e[2] + e[3] + e[4])
                )
            )
            dL[11] = (
                1
                / 15
                * (
                    f[119].calc(L[0])
                    * f[120].calc(L[1])
                    * f[121].calc(L[2])
                    * f[122].calc(L[3])
                    * f[123].calc(L[4])
                    * f[124].calc(L[5])
                    * f[125].calc(L[6])
                    * f[126].calc(L[7])
                    * f[127].calc(L[8])
                    * f[128].calc(L[9])
                    * f[129].calc(L[10])
                    * f[130].calc(L[12])
                    * f[131].calc(L[13])
                    * (e[0] + e[3] + e[4])
                    - e[2]
                )
            )
            dL[12] = (
                1
                / 15
                * (
                    f[132].calc(L[0])
                    * f[133].calc(L[1])
                    * f[134].calc(L[2])
                    * f[135].calc(L[3])
                    * f[136].calc(L[4])
                    * f[137].calc(L[5])
                    * f[138].calc(L[6])
                    * f[139].calc(L[7])
                    * f[140].calc(L[9])
                    * f[141].calc(L[10])
                    * f[142].calc(L[11])
                    * f[143].calc(L[12])
                    * f[144].calc(L[13])
                    - f[145].calc(L[8]) * (e[0] + e[1] + e[2] + e[3] + e[4])
                )
            )
            dL[13] = (
                1
                / 15
                * (
                    f[146].calc(L[4])
                    * f[147].calc(L[6])
                    * f[148].calc(L[10])
                    * f[149].calc(L[12])
                    - (e[0] + e[1] + e[2] + e[3] + e[4])
                )
            )
        except IndexError as e_idx:
            print(f"IndexError in _solve_differential_equations: {e_idx}")
            print(
                f"Len L: {len(L)}, Len f: {len(self.internal_functions)}, Len e: {len(e)}"
            )
            raise
        except Exception as ex:
            print(f"Exception in _solve_differential_equations: {ex}")
            raise
        return dL

    def _save_main_plot(self, X, Y, save_path):
        plt.figure(figsize=(15, 8))
        plt.xlabel("Время")
        plt.ylabel("Значения параметров модели")
        num_lines = Y.shape[1]
        if num_lines <= 20:
            colors = cm.get_cmap("tab20", num_lines)
        else:
            colors = cm.get_cmap("nipy_spectral", num_lines)
        full_labels_for_legend = [f"Характеристика {i+1}" for i in range(num_lines)]
        short_labels = [f"L{i + 1}" for i in range(num_lines)]
        short_labels_for_annotation = [f"L{i+1}" for i in range(num_lines)]
        for i in range(num_lines):
            current_color = colors(i / float(num_lines -1 if num_lines > 1 else 1)) # Нормализация индекса цвета
            label_name = short_labels[i]
            label_name = (
                L_VARIABLE_NAMES[i] if i < len(L_VARIABLE_NAMES) else f"L{i + 1}"
            )
            
            plt.plot(X, Y[:, i], label=full_labels_for_legend[i], color=current_color, linewidth=1.5)

            # plt.plot(X, Y[:, i], label=label_name, color=colors(i / float(num_lines)))

        plt.legend(
            bbox_to_anchor=(1.02, 1),
            loc="upper left",
            borderaxespad=0.0,
            fontsize="small",
        )

        plt.grid(True, linestyle="--", alpha=0.7)
        plt.title(
            "Динамика изменения характеристик L_i", fontsize=14
        )  # Обновим заголовок
        plt.tight_layout(rect=[0, 0, 0.88, 1])  # Откорректируй rect для легенды L1-L14
        plt.savefig(save_path)
        plt.clf()
        plt.close()
        print(f"Main plot saved to {save_path}")


# --- Flask App ---
app = Flask(__name__)
CORS(app)
calculation_service = CalculationService()


@app.route("/")
def index():
    return render_template(
        "index.html",
        NUM_INTERNAL_POLYNOMIALS=NUM_INTERNAL_POLYNOMIALS,
        NUM_EXTERNAL_Q_POLYNOMIALS=NUM_EXTERNAL_Q_POLYNOMIALS,
    )


@app.route("/calculate", methods=["POST"])
def handle_calculate():
    try:
        data = request.json

        variable_limits_from_client = data.get("l_limits", [])

        params_for_service = {
            "start_conditions": [float(x) for x in data.get("start_conditions", [])],
            "initial_f_coeffs": [
                [float(c) for c in p_coeffs]
                for p_coeffs in data.get("initial_f_coeffs", [])
            ],
            "z_coeffs": [
                [float(c) for c in p_coeffs] for p_coeffs in data.get("z_coeffs", [])
            ],
            "poly_output_lower_bound": float(
                data.get("poly_output_lower_bound", 0.001)
            ),
            "max_iterations_coeff_search": int(
                data.get("max_iterations_coeff_search", 1000)
            ),
            "internal_coeff_min_random": float(
                data.get("internal_coeff_min_random", -0.5)
            ),
            "internal_coeff_max_random": float(
                data.get("internal_coeff_max_random", 0.5)
            ),
            "internal_poly_check_range_min": float(
                data.get("internal_poly_check_range_min", 0.0)
            ),
            "internal_poly_check_range_max": float(
                data.get("internal_poly_check_range_max", 1.0)
            ),
            "internal_poly_check_granularity": int(
                data.get("internal_poly_check_granularity", 10)
            ),
            "variable_limits": variable_limits_from_client,
        }

        results = calculation_service.calculate_and_draw(params_for_service)
        return jsonify(results)

    except ValueError as ve:
        app.logger.error(f"ValueError in /calculate: {ve}", exc_info=True)
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        app.logger.error(f"Unhandled Exception in /calculate: {e}", exc_info=True)
        return jsonify({"error": "Произошла внутренняя ошибка сервера."}), 500


if __name__ == "__main__":
    import logging

    logging.basicConfig(level=logging.INFO)
    app.run(debug=True, host="0.0.0.0", port=9090)
