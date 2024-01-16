# -*- coding: utf-8 -*-
import tkinter as tk
import tkinter.messagebox as msgbox
import os
import ast
import operator as op

allowed_operators = {
    ast.Add: op.add,
    ast.Sub: op.sub,
    ast.Mult: op.mul,
    ast.Div: op.truediv
}


# 四則演算処理
def eval_expr(node):
    if isinstance(node, ast.Num):  # <number>
        return node.n
    elif isinstance(node, ast.BinOp):  # <left> <operator> <right>
        return allowed_operators[type(node.op)](
            eval_expr(node.left),
            eval_expr(node.right)
            )
    else:
        raise TypeError(node)


def clear_entries():
    for widget in scroll_frame.winfo_children():
        if (
                widget != num_parties_entry and
                widget != create_button and
                widget != num_parties_label and
                widget != exit_button
        ) and (
            isinstance(widget, tk.Entry) or
            isinstance(widget, tk.Button) or
            isinstance(widget, tk.Label)
        ):
            widget.destroy()


# 行列作成
def create_matrices():
    clear_entries()
    num_parties = int(num_parties_entry.get())

# 当事者名入力
    global name_entries
    clear_name_entries()
    names_label = tk.Label(scroll_frame, text=u'当事者名:', font=font, anchor="e")
    names_label.grid(row=1, column=0, sticky=tk.E)
    name_entries = []
    for i in range(num_parties):
        entry_row = 1 + (i // 5)
        entry_column = 1 + (i % 5)
        number_label = tk.Label(scroll_frame, text=f'{i+1}:', font=font)
        number_label.grid(row=entry_row, column=entry_column-1, sticky=tk.E)
        entry = tk.Entry(scroll_frame)
        entry.grid(row=entry_row, column=entry_column, pady=2)
        name_entries.append(entry)

    name_last_row = 2 + (num_parties // 5)

    # 記入注意
    inputdir_label = tk.Label(
        scroll_frame,
        text=u'縦が請求側です。→の方向に請求しています。',
        font=font,
        anchor="e"
    )
    inputdir_label.grid(
        row=name_last_row+1,
        column=1,
        columnspan=5,
        sticky=tk.E
    )

    # 行列Xのラベル
    matrix_x_label = tk.Label(
        scroll_frame,
        text=u'請求額:',
        font=font,
        anchor="e"
    )
    matrix_x_label.grid(
        row=name_last_row+2,
        column=0,
        sticky=tk.E
    )

    # 行列Xの入力
    matrix_x_entries = []
    for i in range(num_parties):
        row_entries = []
        # 行インデックス
        tk.Label(
            scroll_frame,
            text=str(i+1),
            font=font,
            anchor="e"
        ).grid(
            row=i+name_last_row+3,
            column=0,
            sticky=tk.E
            )
        # 列インデックス
        for j in range(num_parties):
            if i == 0:
                tk.Label(
                    scroll_frame,
                    text=str(j+1),
                    font=font
                    ).grid(
                        row=name_last_row+2,
                        column=j+1
                        )
            if i == j:
                entry = tk.Entry(scroll_frame, state='readonly')
                entry.insert(0, '0')
                entry.config(bg='white')
            else:
                entry = tk.Entry(scroll_frame)
            entry.grid(row=i+name_last_row+3, column=j+1)
            entry.config(bg='white')
            row_entries.append(entry)
        matrix_x_entries.append(row_entries)

    # 行列yのラベル
    matrix_y_label = tk.Label(
        scroll_frame,
        text=u'認容額:',
        font=font,
        anchor="e"
        )
    matrix_y_label.grid(
        row=num_parties+name_last_row+9,
        column=0,
        sticky=tk.E
        )
    # 行列Yの入力
    matrix_y_entries = []
    for i in range(num_parties):
        # 行インデックス
        row_entries = []
        tk.Label(
            scroll_frame,
            text=str(i+1),
            font=font,
            anchor="e"
            ).grid(
                row=i+num_parties+name_last_row+10,
                column=0,
                sticky=tk.E
                )
        for j in range(num_parties):
            # 列インデックス
            if i == 0:
                tk.Label(
                    scroll_frame,
                    text=str(j+1),
                    font=font
                    ).grid(
                        row=num_parties+name_last_row+9,
                        column=j+1
                        )
            if i == j:
                entry = tk.Entry(scroll_frame, state='readonly')
                entry.insert(0, '0')
            else:
                entry = tk.Entry(scroll_frame)
            entry.config(bg='white')  # 背景色をデフォルトに戻す
            entry.grid(row=i+num_parties+name_last_row+10, column=j+1)
            row_entries.append(entry)
        matrix_y_entries.append(row_entries)

    # 行列Zのラベル
    matrix_z_label = tk.Label(
        scroll_frame,
        text=u'訴訟費用の負担割合:',
        font=font,
        anchor="e"
        )
    matrix_z_label.grid(
        row=2*num_parties+name_last_row+22,
        column=0,
        sticky=tk.E
        )

    # 行列Zの入力
    matrix_z_entries = []
    for i in range(num_parties):
        row_entries = []
        # 行インデックス
        tk.Label(
            scroll_frame,
            text=str(i+1),
            font=font,
            anchor="e"
            ).grid(
                row=i+2*num_parties+name_last_row+23,
                column=0,
                sticky=tk.E
                )
        for j in range(num_parties):
            # 列インデックス
            if i == 0:
                tk.Label(
                    scroll_frame,
                    text=str(j+1),
                    font=font
                    ).grid(
                        row=2*num_parties+name_last_row+22,
                        column=j+1
                        )
            entry = tk.Entry(scroll_frame, state='readonly')
            entry.grid(row=i+2*num_parties+name_last_row+23, column=j+1)
            row_entries.append(entry)
        matrix_z_entries.append(row_entries)

    # 計算ボタン
    calculate_button = tk.Button(
        scroll_frame,
        text=u'計算',
        font=font,
        command=lambda: [
                calculate_sharing_ratios(
                    matrix_x_entries,
                    matrix_y_entries,
                    matrix_z_entries
                )
            ]
        )
    calculate_button.grid(
        row=2*num_parties+name_last_row+20,
        column=1+num_parties//2
        )

    window.update()
    canvas.config(scrollregion=canvas.bbox('all'))


def clear_name_entries():
    global name_entries
    for entry in name_entries:
        entry.destroy()
    name_entries = []


# matrix_a(簡単な分数への変換)の表示
def display_matrix_a(matrix_a, num_parties):
    name_last_row = 2 + (num_parties // 5)
    matrix_a_label = tk.Label(
        scroll_frame,
        text=u'おおよその分数:',
        font=font,
        anchor="e"
        )
    matrix_a_label.grid(
        row=3*num_parties+name_last_row+24,
        column=0,
        sticky=tk.E
        )

    for i, row in enumerate(matrix_a):
        # 行インデックス
        tk.Label(
            scroll_frame,
            text=str(i+1),
            font=font,
            anchor="e"
        ).grid(
            row=3*num_parties+name_last_row+i+25,
            column=0,
            sticky=tk.E
            )
        for j, fraction_str in enumerate(row):
            # 列インデックス
            if i == 0:
                tk.Label(
                    scroll_frame,
                    text=str(j+1),
                    font=font
                    ).grid(
                        row=3*num_parties+name_last_row+24,
                        column=j+1
                        )
            matrix_a_entry = tk.Label(
                scroll_frame,
                text=fraction_str,
                font=font
                )
            matrix_a_entry.grid(
                row=3*num_parties+name_last_row+i+25,
                column=j+1
                )
    window.update_idletasks()


# 訴訟費用負担割合計算
def calculate_sharing_ratios(
        matrix_x_entries,
        matrix_y_entries,
        matrix_z_entries
        ):
    num_parties = len(matrix_x_entries)

    matrix_x = []
    matrix_y = []
    red_boxes = 0  # matrix_x<matrix_y:認容額が請求額超えのボックスの数

    # 行列Xの入力
    for i in range(num_parties):
        row = []
        for j in range(num_parties):
            claim = matrix_x_entries[i][j].get()
            claim = eval_expr(
                ast.parse(claim, mode='eval').body
                ) if claim else 0.0
            row.append(claim)
        matrix_x.append(row)

    # 行列Yの入力
    for i in range(num_parties):
        row = []
        for j in range(num_parties):
            acceptance = matrix_y_entries[i][j].get()
            acceptance = eval_expr(
                ast.parse(acceptance, mode='eval').body
                ) if acceptance else 0.0
            row.append(acceptance)
        matrix_y.append(row)

    # 請求額と認容額を比較し、認容額が請求額を上回っている場合は背景色を赤にする
    for i in range(num_parties):
        for j in range(num_parties):
            if matrix_y[i][j] > matrix_x[i][j]:
                matrix_x_entries[i][j].config(bg='lightcoral')
                matrix_y_entries[i][j].config(bg='lightcoral')
                red_boxes += 1

    # 行列Zの作成
    matrix_z = {}
    for i in range(num_parties):
        matrix_z[i] = {}
        for j in range(num_parties):
            if i == j:
                numerator = sum(
                    matrix_x[i][k] for k in range(num_parties)
                    ) + sum(
                        matrix_y[k][i] for k in range(num_parties)
                        ) - sum(
                            matrix_y[i][k] for k in range(num_parties)
                            )
                denominator = sum(
                    matrix_x[i][k] for k in range(num_parties)
                    ) + sum(
                        matrix_x[k][i] for k in range(num_parties)
                        )
                if denominator == 0:
                    matrix_z[i][i] = 0
                else:
                    matrix_z[i][i] = (numerator / denominator) * 100
            else:
                numerator = matrix_y[j][i] + matrix_x[i][j] - matrix_y[i][j]
                denominator = sum(
                    matrix_x[j][k] for k in range(num_parties)
                    ) + sum(
                        matrix_x[k][j] for k in range(num_parties)
                        )
                if denominator == 0:
                    matrix_z[i][j] = 0
                else:
                    matrix_z[i][j] = (numerator / denominator) * 100

    # 簡単にした分数の計算
    matrix_a = []
    for j in range(num_parties):
        column = [matrix_z[i][j] for i in range(num_parties)]
        fractions_column = find_min_denominator_with_constraints(column)
        matrix_a.append(fractions_column)  # matrix_aに列を追加

    matrix_a_tranposed = [
        [
            matrix_a[j][i] for j in range(len(matrix_a))
            ] for i in range(len(matrix_a[0]))
            ]

    # 行列Zの表示
    for i in range(num_parties):
        for j in range(num_parties):
            # 状態を'normal'に変更
            matrix_z_entries[i][j].config(state='normal')
            # 既存の値を削除
            matrix_z_entries[i][j].delete(0, tk.END)
            # 新しい値を挿入
            matrix_z_entries[i][j].insert(0, round(matrix_z[i][j], 2))
            # 状態を'readonly'に戻す
            matrix_z_entries[i][j].config(state='readonly')

    if red_boxes > 0:
        msgbox.showinfo(u'注意', u'赤い部分の認容額が請求額を上回っています')

    # Display Matrix A
    display_matrix_a(matrix_a_tranposed, num_parties)

    # create textbox
    create_text_box(matrix_a_tranposed, num_parties)


# 近似分数計算
def find_min_denominator_with_constraints(
        numbers: list[float],
        max_deviation: float = 0.15,
        min_percentage: float = 0.005,
        max_denominator: int = 100
        ) -> list[str]:
    """
    厳密解を元に、元の負担割合から15%の範囲で値を変えつつ、大小関係を、少なくとも
    不等号が逆転しない限度で維持しつつ、分母が可能な限り分数を探す。
    ただし、分母が10になるまでは、粗すぎる近似になるおそれがあるので、
    その範囲で誤差が最も小さな分母を探すこととする。
    分母が10までの分数については、各分母で求められる誤差を分母が10になるまで累積し、
    累積値が最小値となった分母を最適解とみなす。11以上の分母については、許容誤差率である
    15%に初めて収まった値を最適解とみなしている。
    負担割合が0.5%以下である場合は、訴訟費用の負担割合を0にすることを許容している。
    なお、分母は、最大でも100までとする。

    Args:
    numbers (List[int]): A list of integers.
    max_deviation (float): Maximum allowed deviation from the original ratio.
    min_percentage (float): Minimum percentage to consider, below which
                            ratios are rounded to zero.
    max_denominator (int): The maximum allowed denominator.

    Returns:
    List[str]: A list of strings representing the best approximated fractions.
    """
    total = sum(numbers)
    if total == 0:
        best_fractions = ['0' for _ in range(len(numbers))]
    else:
        original_ratios = [num / total for num in numbers]
        best_fractions = None
        smallest_deviation = float('inf')
        fallback_fractions = None

        for denominator in range(2, max_denominator + 1):
            valid = True
            fractions = []
            current_deviation = 0

            for i, num in enumerate(numbers):
                if num == 0:
                    fraction_str = "0"
                else:
                    fraction = round(num * denominator / total)
                    if fraction / denominator < min_percentage:
                        fraction = 0
                    if fraction == denominator:
                        fraction_str = "全部"
                    else:
                        fraction_str = f"{fraction}/{denominator}"
                        """
                        Check if the deviation from the original ratio is
                        within the allowed range
                        """
                        if original_ratios[i] == 0:
                            fraction_str = "0"
                        else:
                            deviation = abs(
                                fraction / denominator - original_ratios[i]
                                )
                            current_deviation += deviation
                            if deviation > max_deviation * original_ratios[i]:
                                valid = False
                                break

                fractions.append(fraction_str)

            if valid:
                if denominator <= 10 and (
                        best_fractions is None or
                        current_deviation < smallest_deviation
                        ):
                    best_fractions = fractions
                    smallest_deviation = current_deviation
                elif best_fractions is not None:
                    break
                elif best_fractions is None and denominator > 10:
                    best_fractions = fractions
                    break
            elif denominator == max_denominator:
                fallback_fractions = fractions

        if best_fractions is not None:
            print(best_fractions)
            return best_fractions
        elif fallback_fractions is not None:
            return fallback_fractions
        else:
            return ["Cannot find a suitable denominator \
            within the given constraints"]


# 全角数字の辞書を定義
full_width_numbers = {
    '0': '０', '1': '１', '2': '２', '3': '３',
    '4': '４', '5': '５', '6': '６', '7': '７',
    '8': '８', '9': '９'
}


# "半角数字A/半角数字B"の文字列形式を全角数字"B分のA"の形式に変換する関数
def convert_format(matrix_a_value):
    a, b = matrix_a_value.split('/')
    # 半角数字を全角数字に変換
    a = ''.join([full_width_numbers[n] for n in a])
    b = ''.join([full_width_numbers[n] for n in b])
    # "B分のA"の形式に変換
    matrix_a_value = '{}分の{}'.format(b, a)
    return matrix_a_value


# 訴訟費用負担割合のテキストボックス作成
def create_text_box(matrix_a_tranposed, num_parties):
    global name_entries
    name_last_row = 2 + (num_parties // 5)

    # 主文例のラベル
    result_label = tk.Label(
        scroll_frame,
        text=u'主文例:',
        font=font,
        anchor="e"
        )
    result_label.grid(
        row=4*num_parties+name_last_row+25,
        column=0,
        sticky=tk.E
        )

    text_box = tk.Text(scroll_frame, wrap=tk.WORD, width=100, height=5)
    text_box.grid(
        row=4*num_parties+name_last_row+25,
        column=1,
        columnspan=num_parties,
        pady=20,
        sticky=tk.W
        )

    for i in range(num_parties):  # i行目について繰り返す
        costs = []
        name_x = name_entries[i].get() if name_entries[i].get() else str(i + 1)
        if i == num_parties - 1:
            separator = f"を{name_x}の負担とする。"
        elif all(v == '0' for v in matrix_a_tranposed[i+1:][:]):
            separator = f"を{name_x}の負担とする。"
        elif all(v == '0' for v in matrix_a_tranposed[i][:]):
            continue
        else:
            separator = f"を{name_x}の"

        for j in range(num_parties):  # j列目について繰り返す
            if matrix_a_tranposed[i][j] == '全部':
                name_y = name_entries[j].get() if name_entries[j].get() \
                    else str(j + 1)
                ratio = matrix_a_tranposed[i][j]
                costs.append(f"、{name_y}に生じた費用の{ratio}")
            elif matrix_a_tranposed[i][j] != '0':  # 値が0でない場合のみ記載
                # 当事者名が入力されている場合はその名前を表示、そうでなければ番号を表示
                name_y = name_entries[j].get() if name_entries[j].get() \
                    else str(j + 1)
                ratio = convert_format(matrix_a_tranposed[i][j])
                costs.append(f"、{name_y}に生じた費用の{ratio}")
        costs.append(f"{separator}")
        if costs:
            text_box.insert(tk.END, f"{''.join(costs)}")
    final_text = "訴訟費用は" + text_box.get(0., tk.END)
    text_box.delete(0., tk.END)
    text_box.insert(0., final_text)


window = tk.Tk()
os.environ["DISPLAY"] = ":0"
os.environ["LANG"] = "ja_JP.UTF-8"
font = ("Meiryo", 10)
icon_data = """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
ZDLh//mU2bKJKyqAAAAAAElFTkSuQmCC"""

window.title(u'Calc64～訴訟費用負担割合計算機～')
window.geometry("1200x900")
photo = tk.PhotoImage(data=icon_data)
window.iconphoto(False, photo)
name_entries = []

# scroll_frame作成
scroll_frame = tk.Frame(window)
scroll_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

# スクロールバー付きのCanvasを作成
canvas = tk.Canvas(scroll_frame)
canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

# 縦スクロールバーを作成
v_scrollbar = tk.Scrollbar(
    canvas,
    orient='vertical',
    command=canvas.yview
    )
v_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

# 横スクロールバーを作成
h_scrollbar = tk.Scrollbar(
    canvas,
    orient='horizontal',
    command=canvas.xview
    )
h_scrollbar.pack(side=tk.BOTTOM, fill=tk.X)

# Canvasのスクロールコマンドを設定
canvas.configure(
    yscrollcommand=v_scrollbar.set,
    xscrollcommand=h_scrollbar.set
    )


# Canvasのスクロール領域を更新する関数
def update_scrollregion(event):
    canvas.configure(scrollregion=canvas.bbox("all"))


# Canvasにフレームを追加
scroll_frame = tk.Frame(canvas)
canvas.create_window((0, 0), window=scroll_frame, anchor='nw')

# フレームのサイズが変更されたときにスクロール領域を更新
scroll_frame.bind('<Configure>', update_scrollregion)
canvas.bind("<Configure>", update_scrollregion)

# 当事者の数の入力
num_parties_label = tk.Label(
    scroll_frame,
    text=u'当事者数:',
    font=font,
    anchor="e"
    )
num_parties_label.grid(
    row=0,
    column=0,
    sticky=tk.E
    )
num_parties_entry = tk.Entry(scroll_frame)
num_parties_entry.grid(row=0, column=1)

# ボタン
create_button = tk.Button(
    scroll_frame,
    text=u'入力画面作成',
    font=font,
    command=create_matrices
    )

create_button.grid(
    row=0,
    column=2,
    columnspan=2,
    sticky=tk.W
    )

# 終了ボタン
exit_button = tk.Button(
    scroll_frame,
    text=u'終了',
    font=font,
    command=window.destroy
    )
exit_button.grid(
    row=0,
    column=4,
    sticky=tk.E
    )

window.mainloop()
