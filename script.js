new Vue({
  el: "#app",
  data: {
    map: null,
    bysat: "https://api.bysat.com.br",
    base: "https://laboratorio-python-fczdesenvolvime.replit.app", // URL base da API
    gerencias: [], // Armazena as gerências carregadas
    roteiros: [], // Armazena os roteiros carregados
    locais: [], // Armazena os locais carregados
    prefixos: [],
    tipos: [], // Armazena os tipos carregados
    listaLocais: [], // Armazena a lista completa de locais
    gerencia: null,
    roteiro: null,
    polilinhas: [],
    trechos: [],
    placa: null,
    data: null,
    inicio: null,
    fim: null,
    bearer: null,
    show: true,
    percurso: [],
    telemetria: [],
    ranger: 50,
    pontos: [],
    ponto: null,
    intervalo: 120000,
    showIntervalo: false,
    liberacao: null,
  },
  watch: {
    trechos: function (n, o) {
      this.renderizarPolilinhas();
    },

    percurso: function (n, o) {
      this.renderizarPercurso();
    },

    telemetria: function (newValue, oldValue) {
      const max = Math.round(newValue.length / this.ranger);

      newValue.forEach((n, i) => {
        if (i % this.ranger === 0) {
          this.adicionarMarcadorPersonalizado(
            n.latitude,
            n.longitude,
            n.data,
            i / this.ranger,
            i / this.ranger === max ? true : false
          );

          this.pontos.push({ latitude: n.latitude, longitude: n.longitude });
        }
      });
    },
  },
  mounted() {
    this.initMap();
    this.carregarGerencias();
    this.carregarLocais();
  },
  methods: {
    adicionarMarcador(latitude, longitude, nome, vetor) {
      // Cria um marcador usando as coordenadas fornecidas
      const marker = L.marker([latitude, longitude]).addTo(this.map);

      // Adiciona um popup ao marcador com o nome e vetor
      marker.bindPopup(`<b>${nome}</b><br>${vetor}`).openPopup();
    },
    adicionarMarcadorPersonalizado(latitude, longitude, hora, numero, max) {
      // Cria um ícone numerado usando a função criarIcone
      const icon = this.criarIcone(numero, max);

      // Cria um marcador usando as coordenadas fornecidas e o ícone numerado
      const marker = L.marker([latitude, longitude], { icon }).addTo(this.map);

      // Adiciona um popup ao marcador com o nome e vetor
      marker.bindPopup(`<b>${hora}</b>`).openPopup();
    },
    adicionarTempo(milisegundos) {
      const dataAtual = new Date();
      const novaData = new Date(dataAtual.getTime() + milisegundos);

      const horas = String(novaData.getHours()).padStart(2, "0");
      const minutos = String(novaData.getMinutes()).padStart(2, "0");
      this.liberacao = `Próxima consulta liberada apenas às ${horas}:${minutos}`;
      this.showIntervalo = true;
      Swal.fire("Aviso", this.liberacao, "warning");
      setTimeout(() => {
        this.showIntervalo = false;
        Swal.fire("Aviso", "Nova consulta liberada.", "warning");
      }, this.intervalo);
    },
    adicionarUmDia(dataStr) {
      // Converte a string de data para um objeto Date
      const data = new Date(dataStr.replace(" ", "T"));

      // Adiciona um dia em milissegundos (24 horas * 60 minutos * 60 segundos * 1000 milissegundos)
      data.setDate(data.getDate() + 1);

      // Formata a data de volta para o formato original "YYYY-MM-DD HH:mm:ss"
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, "0");
      const dia = String(data.getDate()).padStart(2, "0");
      const horas = String(data.getHours()).padStart(2, "0");
      const minutos = String(data.getMinutes()).padStart(2, "0");
      const segundos = String(data.getSeconds()).padStart(2, "0");

      return `${ano}-${mes}-${dia} ${horas}:${minutos}:${segundos}`;
    },
    buscarRoteiro() {
      this.limparMapa();

      const url = `${this.base}/marcadores/${this.gerencia}/${this.roteiro}`;

      axios
        .get(url)
        .then((response) => {
          const { status, data } = response;
          if (status === 200 || status === 201) {
            data.forEach((d) => {
              this.adicionarMarcador(
                parseFloat(d.latitude),
                parseFloat(d.longitude),
                d.nome,
                d.vetor
              );
            });
          }
        })
        .then(() => {
          const url = `${this.base}/coordenadas/${this.gerencia}/${this.roteiro}`;
          axios
            .get(url)
            .then((response) => {
              const { data, status } = response;
              if (status === 200 || status === 201) {
                data.forEach((d) => {
                  d.polilinha = this.decodificarOverwiewPolyline(d.polilinha);
                  this.polilinhas.push(d);
                });

                this.polilinhas.sort((a, b) => a.uid - b.uid);
                this.trechos = this.polilinhas.filter(
                  (x) => x.opcao === "coleta"
                );
              }
            })
            .catch((error) =>
              Swal.fire("Erro no servidor", error.message, "error")
            );
        })
        .catch((error) =>
          Swal.fire("Erro no servidor", error.message, "error")
        );
    },
    buscarTelemetria() {
      this.limparMapa();
      this.buscarRoteiro();

      const roteiro = this.prefixos.filter((x) => x.roteiro === this.roteiro);
      const { inicio, fim } = roteiro[0];

      this.inicio = `${this.data} ${inicio.toString().padStart(2, "0")}:00:00`;

      if (inicio > fim) {
        this.fim = `${this.adicionarMarcador(this.data)} ${fim
          .toString()
          .padStart(2, "0")}:00:00`;
      } else {
        this.fim = `${this.data} ${fim.toString().padStart(2, "0")}:00:00`;
      }

      const data = {
        bearer: this.bearer,
        placa: this.placa,
        inicio: this.inicio,
        fim: this.fim,
      };

      console.log(data);

      const url = `${this.base}/telemetria`;

      const config = {
        method: "post",
        url,
        headers: {
          Authorization: `Bearer ${this.bearer}`,
        },
        data,
      };

      this.show = false;

      axios(config)
        .then((response) => {
          this.telemetria = response.data.map((d) => ({
            empresa: d.empresa,
            data: d.data_transmissao,
            frota: d.frota,
            id: d.id_veiculo,
            latitude: d.latitude,
            longitude: d.longitude,
            motorista: d.nome_condutor,
            uid: this.converterParaMilisegundos(d.data_transmissao),
          }));

          this.telemetria
            .sort((a, b) => a.uid - b.uid)
            .forEach((el) => {
              this.percurso.push([el.latitude, el.longitude]);
            });

          this.show = true;
          this.data = null;
        })
        .then(() => this.adicionarTempo(this.intervalo))
        .catch((error) => {
          this.show = true;
          Swal.fire("Error", error.message, "error");
        });
    },
    carregarGerencias() {
      fetch(`${this.base}/gerencias`)
        .then((response) => response.json())
        .then((data) => {
          const gerencias = new Set();
          data.forEach((item) => {
            gerencias.add(item.gerencia);
          });
          this.gerencias = Array.from(gerencias);
          this.roteiros = data;
        });
    },
    carregarLocais() {
      this.prefixos = [];
      fetch(`${this.base}/roteiros`)
        .then((response) => response.json())
        .then((data) => {
          const prefixos = new Set();
          data.forEach((item) => {
            prefixos.add(item);
          });

          this.prefixos = Array.from(prefixos);
        });
    },
    centralizarMapa(latitude, longitude, zoom = 16) {
      this.map.setView([latitude, longitude], zoom);
    },
    converterParaMilisegundos(dataHora) {
      const [data, hora] = dataHora.split(" ");
      const [dia, mes, ano] = data.split("/");
      const dataFormatada = `${ano}-${mes}-${dia}T${hora}`;
      return new Date(dataFormatada).getTime();
    },
    criarIcone(text, max) {
      const html =
        text == "0" || max === true
          ? `<div style="background-color: #8B0000; color: #FFFFFF; border-radius: 50%; width: 21px; height: 21px; display: flex; align-items: center; justify-content: center; font-size: 14px;">${text}</div>`
          : `<div style="background-color: #1E90FF; color: #FFFFFF; border-radius: 50%; width: 21px; height: 21px; display: flex; align-items: center; justify-content: center; font-size: 14px;">${text}</div>`;

      return L.divIcon({
        html,
        className: "", // Remova a classe padrão
        iconSize: [21, 21],
        iconAnchor: [10, 21],
        popupAnchor: [1, -21],
        shadowSize: [41, 41],
      });
    },
    decodificarOverwiewPolyline(encoded) {
      let index = 0,
        len = encoded.length;
      let lat = 0,
        lng = 0;
      const coordinates = [];

      while (index < len) {
        let b,
          shift = 0,
          result = 0;

        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);

        const dlat = result & 1 ? ~(result >> 1) : result >> 1;
        lat += dlat;

        shift = 0;
        result = 0;

        do {
          b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);

        const dlng = result & 1 ? ~(result >> 1) : result >> 1;
        lng += dlng;

        coordinates.push([lat * 1e-5, lng * 1e-5]);
      }

      return coordinates;
    },
    initMap() {
      this.map = L.map("map").setView([-22.9068, -43.1729], 13);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
        }
      ).addTo(this.map);
    },
    irParaPonto() {
      if (this.ponto >= 0 && this.ponto < this.pontos.length) {
        console.log();
        const { latitude, longitude } = this.pontos[this.ponto];
        this.centralizarMapa(latitude, longitude);
      } else {
        Swal.fire("Aviso", "Busque um ponto válido", "warning");
      }
    },
    limparMapa() {
      this.polilinhas = [];
      this.trechos = [];
      this.percurso = [];
      this.pontos = [];
      this.map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          return; // Mantém a camada base
        }
        this.map.removeLayer(layer); // Remove outras camadas
      });
    },
    renderizarPolilinhas() {
      this.trechos.forEach((trecho) => {
        const polilinha = L.polyline(trecho.polilinha, {
          color: "red", // Cor fixa para a polilinha
          weight: 4, // Espessura da linha
          opacity: 0.8, // Opacidade da linha
        }).addTo(this.map);

        // Centralizar o mapa na primeira polilinha adicionada
        this.map.fitBounds(polilinha.getBounds());
      });
    },
    renderizarPercurso() {
      const polilinha = L.polyline(this.percurso, {
        color: "blue", // Cor fixa para a polilinha
        weight: 1, // Espessura da linha
        opacity: 0.5, // Opacidade da linha
      }).addTo(this.map);

      // Centralizar o mapa na primeira polilinha adicionada
      if (polilinha) {
        this.map.fitBounds(polilinha.getBounds());
      }
    },
    updateRoteiros() {
      this.roteiro = ""; // Reset the selected roteiro
    },
  },
  computed: {
    filteredRoteiros() {
      return this.roteiros
        .filter((item) => item.gerencia === this.gerencia)
        .map((item) => item.roteiro);
    },
    filteredLocais() {
      return this.locais
        .filter((item) => item.tipo === this.tipo)
        .map((item) => item);
    },
    filteredPrefixos() {
      const arr = [];

      const filter = this.prefixos.filter(
        (item) => item.gerencia === this.gerencia
      );

      return this.prefixos.filter((x) => x.gerencia === this.gerencia);
    },
  },
});
