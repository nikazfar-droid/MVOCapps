from flask import Flask, render_template_string
import tkinter as tk

app = Flask(__name__)

def run_gui():
    root = tk.Tk()
    root.title("Network Monitoring App")
    
    label = tk.Label(root, text="Monitoring Network...")
    label.pack(pady=20)
    
    root.mainloop()

@app.route('/')
def index():
    run_gui()  # Jalankan GUI di latar belakang
    return "GUI is running in the background"

if __name__ == "__main__":
    app.run(debug=True, host='127.0.0.1', port=5000)